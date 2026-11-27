'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getOwnedQuest } from '@/features/quests/quest-service'
import { canonicalizeUrl, titleFromUrl, type ResourceType } from '@/features/resources/resource-domain'
import { getPageSession } from '@/lib/page-session'
import { BOOKMARK_LIMITS, parseBookmarksHtml, type ParseResult } from './bookmark-parser'
import { parseExtensionPayload } from './extension-payload'
import { chunk, getOwnedRun, type ImportCandidate } from './import-service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const IMPORT_HOME = '/library/import'
const CHROME_PROVIDERS = ['chrome_html', 'chrome_extension'] as const
type ChromeProvider = (typeof CHROME_PROVIDERS)[number]

function redirectWithNotice(path: string, notice: string): never {
  revalidatePath('/library')
  revalidatePath(IMPORT_HOME)
  if (path !== IMPORT_HOME) revalidatePath(path)
  redirect(`${path}?notice=${notice}`)
}

function safeFileName(name: string): string | null {
  const base = name.split(/[\\/]/).pop()?.replace(/[\u0000-\u001f]/g, '').trim() ?? ''
  return base ? base.slice(0, 255) : null
}

/** Step 1: parse an uploaded bookmark export on the server and stage its links for review. Nothing is imported yet. */
export async function stageChromeImportAction(formData: FormData): Promise<void> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) redirectWithNotice(IMPORT_HOME, 'import-no-file')
  if (file.size > BOOKMARK_LIMITS.maxBytes) redirectWithNotice(IMPORT_HOME, 'import-too-large')
  if (!/\.html?$/i.test(file.name)) redirectWithNotice(IMPORT_HOME, 'import-not-bookmarks')

  const parsed = parseBookmarksHtml(await file.text(), canonicalizeUrl)
  if ('error' in parsed) {
    redirectWithNotice(IMPORT_HOME, parsed.error === 'too_large' ? 'import-too-large' : parsed.error === 'empty' ? 'import-empty' : 'import-not-bookmarks')
  }
  if (parsed.bookmarks.length === 0) redirectWithNotice(IMPORT_HOME, 'import-empty')
  await stageParsedBookmarks('chrome_html', safeFileName(file.name), parsed, parsed.truncated ? 'import-staged-truncated' : 'import-staged')
}

/**
 * Step 1 (extension): bookmarks chosen and approved in the LifeOS Chrome extension arrive as JSON via the
 * import page. They are validated and re-canonicalised here, then staged exactly like an uploaded file.
 */
export async function stageExtensionImportAction(formData: FormData): Promise<void> {
  const parsed = parseExtensionPayload(formData.get('payload'), canonicalizeUrl)
  if ('error' in parsed) {
    redirectWithNotice(IMPORT_HOME, parsed.error === 'too_large' ? 'import-extension-too-large' : parsed.error === 'empty' ? 'import-empty' : 'import-extension-invalid')
  }
  await stageParsedBookmarks('chrome_extension', 'Chrome bookmarks (extension)', parsed, parsed.truncated ? 'import-staged-extension-truncated' : 'import-staged-extension')
}

async function stageParsedBookmarks(provider: ChromeProvider, fileName: string | null, parsed: ParseResult, successNotice: string): Promise<never> {
  const { supabase, userId } = await getPageSession()
  const { data: run, error: runError } = await supabase.from('import_runs').insert({
    user_id: userId,
    provider,
    file_name: fileName,
    items_seen: parsed.total,
    items_staged: parsed.bookmarks.length,
    items_skipped: parsed.skippedUnsupported + parsed.duplicatesInFile,
  }).select('id').single()
  if (runError || !run) redirectWithNotice(IMPORT_HOME, 'save-failed')

  const existing = new Set<string>()
  for (const part of chunk(parsed.bookmarks.map((b) => b.canonical), 200)) {
    const { data } = await supabase.from('learning_resources').select('canonical_url').eq('user_id', userId).in('canonical_url', part)
    for (const row of (data ?? []) as Array<{ canonical_url: string }>) existing.add(row.canonical_url)
  }

  const rows = parsed.bookmarks.map((bookmark, position) => ({
    user_id: userId,
    import_run_id: run.id,
    position,
    url: bookmark.url,
    canonical_url: bookmark.canonical,
    title: bookmark.title,
    folder_path: bookmark.folderPath || null,
    resource_type: bookmark.inferredType,
    source_added_at: bookmark.addedAt,
    already_in_library: existing.has(bookmark.canonical),
  }))
  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from('import_candidates').insert(part)
    if (error) {
      await supabase.from('import_candidates').delete().eq('import_run_id', run.id).eq('user_id', userId)
      await supabase.from('import_runs').update({ status: 'failed', error_code: 'staging_failed' }).eq('id', run.id).eq('user_id', userId)
      redirectWithNotice(IMPORT_HOME, 'save-failed')
    }
  }
  redirectWithNotice(`${IMPORT_HOME}/${run.id}`, successNotice)
}

async function requireStagedRun(formData: FormData) {
  const runId = formData.get('runId')
  if (typeof runId !== 'string' || !UUID.test(runId)) redirectWithNotice(IMPORT_HOME, 'record-not-found')
  const context = await getPageSession()
  const run = await getOwnedRun(context.supabase, context.userId, runId)
  if (!run) redirectWithNotice(IMPORT_HOME, 'record-not-found')
  if (run.status !== 'staged') redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'import-not-staged')
  if (!(CHROME_PROVIDERS as readonly string[]).includes(run.provider)) redirectWithNotice(IMPORT_HOME, 'record-not-found')
  if (new Date(run.expires_at).getTime() <= Date.now()) redirectWithNotice(IMPORT_HOME, 'import-expired')
  return { ...context, run }
}

/**
 * Step 2: import only the candidates the user selected. Candidate data is re-read from the database
 * (never trusted from the form). Existing resources are never overwritten: they only gain a source record.
 */
export async function confirmImportAction(formData: FormData): Promise<void> {
  const { supabase, userId, run } = await requireStagedRun(formData)
  const provider = run.provider as ChromeProvider
  const selectedIds = [...new Set(formData.getAll('candidate').filter((v): v is string => typeof v === 'string' && UUID.test(v)))]
  if (selectedIds.length === 0) redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'import-nothing-selected')
  const questId = formData.get('questId')
  const quest = typeof questId === 'string' && UUID.test(questId) ? await getOwnedQuest(supabase, userId, questId) : null
  if (typeof questId === 'string' && questId !== '' && !quest) redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'record-not-found')

  const candidates: ImportCandidate[] = []
  for (const part of chunk(selectedIds, 200)) {
    const { data } = await supabase.from('import_candidates').select('id,position,url,canonical_url,title,folder_path,resource_type,already_in_library')
      .eq('import_run_id', run.id).eq('user_id', userId).in('id', part)
    candidates.push(...((data ?? []) as ImportCandidate[]))
  }
  if (candidates.length === 0) redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'import-nothing-selected')

  // Insert new resources; ON CONFLICT DO NOTHING keeps existing (possibly user-edited) resources untouched.
  let imported = 0
  for (const part of chunk(candidates, 500)) {
    const rows = part.map((candidate) => {
      const canonical = canonicalizeUrl(candidate.url)
      return {
        user_id: userId,
        url: candidate.url,
        canonical_url: candidate.canonical_url,
        url_source: 'chrome',
        title: candidate.title ?? (canonical.ok ? titleFromUrl(canonical.value) : candidate.canonical_url).slice(0, 500),
        title_source: 'chrome',
        resource_type: candidate.resource_type as ResourceType,
        origin: provider,
      }
    })
    const { data, error } = await supabase.from('learning_resources').upsert(rows, { onConflict: 'user_id,canonical_url', ignoreDuplicates: true }).select('id')
    if (error) {
      await supabase.from('import_runs').update({ status: 'failed', error_code: 'import_failed', items_imported: imported }).eq('id', run.id).eq('user_id', userId)
      redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'save-failed')
    }
    imported += (data ?? []).length
  }

  // Resolve every selected canonical URL to its resource id (new or existing), then record provenance and optional quest links.
  const idByCanonical = new Map<string, string>()
  for (const part of chunk(candidates.map((c) => c.canonical_url), 200)) {
    const { data } = await supabase.from('learning_resources').select('id,canonical_url').eq('user_id', userId).in('canonical_url', part)
    for (const row of (data ?? []) as Array<{ id: string; canonical_url: string }>) idByCanonical.set(row.canonical_url, row.id)
  }
  const now = new Date().toISOString()
  const sourceRows = candidates.flatMap((candidate) => {
    const resourceId = idByCanonical.get(candidate.canonical_url)
    return resourceId ? [{
      user_id: userId,
      resource_id: resourceId,
      provider,
      external_id: candidate.canonical_url,
      source_url: candidate.url,
      source_title: candidate.title,
      provider_metadata: candidate.folder_path ? { folder_path: candidate.folder_path } : {},
      import_run_id: run.id,
      first_seen_at: now,
      last_seen_at: now,
    }] : []
  })
  for (const part of chunk(sourceRows, 500)) {
    await supabase.from('resource_source_records').upsert(part, { onConflict: 'user_id,provider,external_id', ignoreDuplicates: true })
  }
  if (quest) {
    const links = [...idByCanonical.values()].map((resourceId) => ({ user_id: userId, quest_id: quest.id, resource_id: resourceId }))
    for (const part of chunk(links, 500)) {
      await supabase.from('quest_resources').upsert(part, { onConflict: 'quest_id,resource_id', ignoreDuplicates: true })
    }
  }

  await supabase.from('import_runs').update({
    status: 'completed',
    completed_at: now,
    items_imported: imported,
    items_duplicate: candidates.length - imported,
  }).eq('id', run.id).eq('user_id', userId).eq('status', 'staged')
  await supabase.from('import_candidates').delete().eq('import_run_id', run.id).eq('user_id', userId)
  if (quest) revalidatePath(`/quests/${quest.id}`)
  redirectWithNotice(`${IMPORT_HOME}/${run.id}`, 'import-completed')
}

export async function cancelImportAction(formData: FormData): Promise<void> {
  const { supabase, userId, run } = await requireStagedRun(formData)
  await supabase.from('import_candidates').delete().eq('import_run_id', run.id).eq('user_id', userId)
  await supabase.from('import_runs').update({ status: 'cancelled' }).eq('id', run.id).eq('user_id', userId).eq('status', 'staged')
  redirectWithNotice(IMPORT_HOME, 'import-cancelled')
}

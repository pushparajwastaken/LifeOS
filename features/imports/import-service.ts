import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type ImportRun = {
  id: string
  provider: string
  status: 'staged' | 'completed' | 'failed' | 'cancelled' | 'expired'
  file_name: string | null
  items_seen: number
  items_staged: number
  items_skipped: number
  items_imported: number
  items_duplicate: number
  error_code: string | null
  expires_at: string
  completed_at: string | null
  created_at: string
}

export type ImportCandidate = {
  id: string
  position: number
  url: string
  canonical_url: string
  title: string | null
  folder_path: string | null
  resource_type: string
  already_in_library: boolean
}

const RUN_SELECT = 'id,provider,status,file_name,items_seen,items_staged,items_skipped,items_imported,items_duplicate,error_code,expires_at,completed_at,created_at'

/** Staged runs past their expiry are marked expired and their candidates removed (under the user's session). */
export async function expireStaleRuns(supabase: Supabase, userId: string) {
  const now = new Date().toISOString()
  const { data } = await supabase.from('import_runs').select('id').eq('user_id', userId).eq('status', 'staged').lt('expires_at', now)
  const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ids.length === 0) return
  await supabase.from('import_candidates').delete().eq('user_id', userId).in('import_run_id', ids)
  await supabase.from('import_runs').update({ status: 'expired' }).eq('user_id', userId).in('id', ids).eq('status', 'staged')
}

export async function getImportHistory(supabase: Supabase, userId: string): Promise<{ runs: ImportRun[]; hasLoadError: boolean }> {
  await expireStaleRuns(supabase, userId)
  const { data, error } = await supabase.from('import_runs').select(RUN_SELECT).eq('user_id', userId).order('created_at', { ascending: false }).limit(25)
  return { runs: (data ?? []) as ImportRun[], hasLoadError: Boolean(error) }
}

export async function getOwnedRun(supabase: Supabase, userId: string, runId: string): Promise<ImportRun | null> {
  const { data, error } = await supabase.from('import_runs').select(RUN_SELECT).eq('id', runId).eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return data as ImportRun
}

export type ImportRunData = {
  run: ImportRun
  candidates: ImportCandidate[]
  quests: Array<{ id: string; title: string }>
  hasLoadError: boolean
}

export async function getImportRunData(supabase: Supabase, userId: string, runId: string): Promise<ImportRunData | null> {
  await expireStaleRuns(supabase, userId)
  const run = await getOwnedRun(supabase, userId, runId)
  if (!run) return null
  if (run.status !== 'staged') return { run, candidates: [], quests: [], hasLoadError: false }
  const [candidateResult, questResult] = await Promise.all([
    supabase.from('import_candidates').select('id,position,url,canonical_url,title,folder_path,resource_type,already_in_library')
      .eq('import_run_id', runId).eq('user_id', userId).order('position', { ascending: true }).limit(5000),
    supabase.from('side_quests').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200),
  ])
  return {
    run,
    candidates: (candidateResult.data ?? []) as ImportCandidate[],
    quests: (questResult.data ?? []) as Array<{ id: string; title: string }>,
    hasLoadError: Boolean(candidateResult.error || questResult.error),
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

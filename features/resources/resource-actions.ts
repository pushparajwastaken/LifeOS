'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getOwnedQuest } from '@/features/quests/quest-service'
import { getPageSession } from '@/lib/page-session'
import {
  canonicalizeUrl,
  getResourceStatusUpdate,
  resourceInputSchema,
  resourceStatusSchema,
  titleFromUrl,
} from './resource-domain'
import { findResourceByCanonical, getOwnedResource } from './resource-service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Allowed redirect targets: the library, a resource page or a quest page (no open redirects). */
function safeReturnPath(value: string): string {
  if (value === '/library') return value
  const match = /^\/(library|quests)\/([0-9a-f-]{36})$/i.exec(value)
  return match && UUID.test(match[2]) ? value : '/library'
}

function redirectWithNotice(path: string, notice: string): never {
  revalidatePath('/library')
  revalidatePath('/quests')
  revalidatePath('/learning')
  if (path !== '/library') revalidatePath(path)
  redirect(`${path}?notice=${notice}`)
}

function readResourceInput(formData: FormData) {
  return resourceInputSchema.safeParse({
    url: formString(formData, 'url'),
    title: formString(formData, 'title'),
    resourceType: formString(formData, 'resourceType'),
    category: formString(formData, 'category'),
    notes: formString(formData, 'notes'),
  })
}

async function attach(supabase: Awaited<ReturnType<typeof getPageSession>>['supabase'], userId: string, questId: string, resourceId: string) {
  const { error } = await supabase.from('quest_resources').insert({ user_id: userId, quest_id: questId, resource_id: resourceId })
  return !error || error.code === '23505'
}

export async function createResourceAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formString(formData, 'returnTo'))
  const parsed = readResourceInput(formData)
  if (!parsed.success) redirectWithNotice(returnTo, 'input-invalid')
  const canonical = canonicalizeUrl(parsed.data.url)
  if (!canonical.ok) redirectWithNotice(returnTo, canonical.reason === 'unsupported_scheme' ? 'resource-unsafe-url' : 'resource-invalid-url')

  const { supabase, userId } = await getPageSession()
  const questId = formString(formData, 'questId')
  if (questId && (!UUID.test(questId) || !(await getOwnedQuest(supabase, userId, questId)))) redirectWithNotice(returnTo, 'record-not-found')

  // Deduplicate on the canonical URL: an existing resource is reused, never overwritten.
  const existing = await findResourceByCanonical(supabase, userId, canonical.value.canonical)
  if (existing) {
    if (questId) await attach(supabase, userId, questId, existing.id)
    redirectWithNotice(questId ? returnTo : `/library/${existing.id}`, questId ? 'resource-exists-attached' : 'resource-exists')
  }

  const { data, error } = await supabase.from('learning_resources').insert({
    user_id: userId,
    url: canonical.value.url,
    canonical_url: canonical.value.canonical,
    url_source: 'user',
    title: parsed.data.title ?? titleFromUrl(canonical.value),
    title_source: 'user',
    resource_type: parsed.data.resourceType ?? canonical.value.inferredType,
    origin: 'manual',
    category: parsed.data.category,
    notes: parsed.data.notes,
  }).select('id').single()
  if (error?.code === '23505') {
    const raced = await findResourceByCanonical(supabase, userId, canonical.value.canonical)
    if (raced) redirectWithNotice(`/library/${raced.id}`, 'resource-exists')
  }
  if (error || !data) redirectWithNotice(returnTo, 'save-failed')
  if (questId) {
    const attached = await attach(supabase, userId, questId, data.id)
    redirectWithNotice(returnTo, attached ? 'resource-added-attached' : 'resource-added-unattached')
  }
  redirectWithNotice(returnTo === '/library' ? `/library/${data.id}` : returnTo, 'resource-added')
}

async function requireOwnedResource(formData: FormData) {
  const resourceId = formString(formData, 'resourceId')
  const returnTo = safeReturnPath(formString(formData, 'returnTo') || `/library/${resourceId}`)
  if (!UUID.test(resourceId)) redirectWithNotice('/library', 'record-not-found')
  const context = await getPageSession()
  const resource = await getOwnedResource(context.supabase, context.userId, resourceId)
  if (!resource) redirectWithNotice('/library', 'record-not-found')
  return { ...context, resource, returnTo }
}

export async function updateResourceAction(formData: FormData): Promise<void> {
  const { supabase, userId, resource, returnTo } = await requireOwnedResource(formData)
  const parsed = readResourceInput(formData)
  if (!parsed.success) redirectWithNotice(returnTo, 'input-invalid')
  const canonical = canonicalizeUrl(parsed.data.url)
  if (!canonical.ok) redirectWithNotice(returnTo, canonical.reason === 'unsupported_scheme' ? 'resource-unsafe-url' : 'resource-invalid-url')
  if (canonical.value.canonical !== resource.canonical_url) {
    const other = await findResourceByCanonical(supabase, userId, canonical.value.canonical)
    if (other && other.id !== resource.id) redirectWithNotice(returnTo, 'resource-url-taken')
  }
  const urlChanged = canonical.value.url !== resource.url
  const { data, error } = await supabase.from('learning_resources').update({
    url: canonical.value.url,
    canonical_url: canonical.value.canonical,
    ...(urlChanged ? { url_source: 'user' } : {}),
    title: parsed.data.title ?? resource.title,
    ...(parsed.data.title && parsed.data.title !== resource.title ? { title_source: 'user' } : {}),
    resource_type: parsed.data.resourceType ?? resource.resource_type,
    category: parsed.data.category,
    notes: parsed.data.notes,
  }).eq('id', resource.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(returnTo, error?.code === '23505' ? 'resource-url-taken' : error || !data ? 'save-failed' : 'resource-updated')
}

export async function setResourceStatusAction(formData: FormData): Promise<void> {
  const { supabase, userId, resource, returnTo } = await requireOwnedResource(formData)
  const status = resourceStatusSchema.safeParse(formString(formData, 'status'))
  if (!status.success) redirectWithNotice(returnTo, 'input-invalid')
  if (status.data === resource.status) redirectWithNotice(returnTo, 'resource-updated')
  const { data, error } = await supabase.from('learning_resources').update(getResourceStatusUpdate(status.data, new Date()))
    .eq('id', resource.id).eq('user_id', userId).select('id').maybeSingle()
  redirectWithNotice(returnTo, error || !data ? 'save-failed' : `resource-${status.data.replace('_', '-')}`)
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const { supabase, userId, resource } = await requireOwnedResource(formData)
  if (formString(formData, 'confirm') !== 'delete') redirectWithNotice(`/library/${resource.id}`, 'delete-unconfirmed')
  // Quest links and source records cascade; learning sessions keep their minutes and lose only the link.
  const { data, error } = await supabase.from('learning_resources').delete().eq('id', resource.id).eq('user_id', userId).select('id').maybeSingle()
  if (error || !data) redirectWithNotice(`/library/${resource.id}`, 'save-failed')
  redirectWithNotice('/library', 'resource-deleted')
}

async function readLink(formData: FormData) {
  const resourceId = formString(formData, 'resourceId')
  const questId = formString(formData, 'questId')
  const returnTo = safeReturnPath(formString(formData, 'returnTo'))
  if (!UUID.test(resourceId) || !UUID.test(questId)) redirectWithNotice(returnTo, 'record-not-found')
  const context = await getPageSession()
  const [resource, quest] = await Promise.all([
    getOwnedResource(context.supabase, context.userId, resourceId),
    getOwnedQuest(context.supabase, context.userId, questId),
  ])
  if (!resource || !quest) redirectWithNotice(returnTo, 'record-not-found')
  return { ...context, resourceId, questId, returnTo }
}

export async function attachResourceToQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, resourceId, questId, returnTo } = await readLink(formData)
  const ok = await attach(supabase, userId, questId, resourceId)
  redirectWithNotice(returnTo, ok ? 'resource-attached' : 'save-failed')
}

export async function detachResourceFromQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, resourceId, questId, returnTo } = await readLink(formData)
  const { error } = await supabase.from('quest_resources').delete().eq('quest_id', questId).eq('resource_id', resourceId).eq('user_id', userId)
  redirectWithNotice(returnTo, error ? 'save-failed' : 'resource-detached')
}

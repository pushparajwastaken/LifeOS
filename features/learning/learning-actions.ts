'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getOwnedQuest } from '@/features/quests/quest-service'
import { getPageSession } from '@/lib/page-session'
import { sessionInputSchema, sessionInputToRow } from './learning-domain'
import { getOwnedSession } from './learning-service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Only the learning log or a quest page may be a redirect target (no open redirects). */
function safeReturnPath(value: string): string {
  const match = /^\/quests\/([0-9a-f-]{36})$/i.exec(value)
  return match && UUID.test(match[1]) ? value : '/learning'
}

function redirectWithNotice(path: string, notice: string, extra?: Record<string, string>): never {
  revalidatePath('/learning')
  revalidatePath('/quests')
  if (path !== '/learning') revalidatePath(path)
  const params = new URLSearchParams({ notice, ...extra })
  redirect(`${path}?${params.toString()}`)
}

function readSessionInput(formData: FormData) {
  return sessionInputSchema.safeParse({
    questId: formString(formData, 'questId'),
    topic: formString(formData, 'topic'),
    pillar: formString(formData, 'pillar'),
    sessionType: formString(formData, 'sessionType'),
    date: formString(formData, 'date'),
    time: formString(formData, 'time'),
    durationMinutes: formString(formData, 'durationMinutes'),
    notes: formString(formData, 'notes'),
  })
}

export async function logSessionAction(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formString(formData, 'returnTo'))
  const parsed = readSessionInput(formData)
  if (!parsed.success) redirectWithNotice(returnTo, parsed.error.issues.some((i) => i.path[0] === 'topic') ? 'session-needs-topic' : 'input-invalid')
  const { supabase, userId, timeZone } = await getPageSession()
  if (parsed.data.questId && !(await getOwnedQuest(supabase, userId, parsed.data.questId))) redirectWithNotice(returnTo, 'record-not-found')
  const { error } = await supabase.from('learning_sessions').insert({ user_id: userId, ...sessionInputToRow(parsed.data, timeZone) })
  redirectWithNotice(returnTo, error ? 'save-failed' : 'session-logged')
}

async function requireOwnedSession(formData: FormData) {
  const sessionId = formString(formData, 'sessionId')
  const returnTo = safeReturnPath(formString(formData, 'returnTo'))
  if (!UUID.test(sessionId)) redirectWithNotice(returnTo, 'record-not-found')
  const context = await getPageSession()
  const session = await getOwnedSession(context.supabase, context.userId, sessionId)
  if (!session) redirectWithNotice(returnTo, 'record-not-found')
  return { ...context, session, returnTo }
}

export async function updateSessionAction(formData: FormData): Promise<void> {
  const { supabase, userId, timeZone, session, returnTo } = await requireOwnedSession(formData)
  if (session.deleted_at) redirectWithNotice(returnTo, 'record-not-found')
  const parsed = readSessionInput(formData)
  if (!parsed.success) redirectWithNotice(returnTo, parsed.error.issues.some((i) => i.path[0] === 'topic') ? 'session-needs-topic' : 'input-invalid')
  if (parsed.data.questId && !(await getOwnedQuest(supabase, userId, parsed.data.questId))) redirectWithNotice(returnTo, 'record-not-found')
  const { data, error } = await supabase.from('learning_sessions').update(sessionInputToRow(parsed.data, timeZone))
    .eq('id', session.id).eq('user_id', userId).is('deleted_at', null).select('id').maybeSingle()
  redirectWithNotice(returnTo, error || !data ? 'save-failed' : 'session-updated')
}

/** Soft delete: the database stamps deleted_at with its own clock. */
export async function deleteSessionAction(formData: FormData): Promise<void> {
  const { supabase, userId, session, returnTo } = await requireOwnedSession(formData)
  const { data, error } = await supabase.from('learning_sessions').update({ deleted_at: new Date().toISOString() })
    .eq('id', session.id).eq('user_id', userId).is('deleted_at', null).select('id').maybeSingle()
  if (error || !data) redirectWithNotice(returnTo, 'save-failed')
  redirectWithNotice(returnTo, 'session-deleted', { undo: session.id })
}

export async function restoreSessionAction(formData: FormData): Promise<void> {
  const { supabase, userId, session, returnTo } = await requireOwnedSession(formData)
  const { data, error } = await supabase.from('learning_sessions').update({ deleted_at: null })
    .eq('id', session.id).eq('user_id', userId).not('deleted_at', 'is', null).select('id').maybeSingle()
  if (error?.code === 'P0001') redirectWithNotice(returnTo, 'restore-expired')
  redirectWithNotice(returnTo, error || !data ? 'save-failed' : 'session-restored')
}

/** Permanent delete, only for sessions that are already in Recently deleted. */
export async function purgeSessionAction(formData: FormData): Promise<void> {
  const { supabase, userId, session, returnTo } = await requireOwnedSession(formData)
  if (formString(formData, 'confirm') !== 'purge') redirectWithNotice(returnTo, 'delete-unconfirmed')
  const { data, error } = await supabase.from('learning_sessions').delete()
    .eq('id', session.id).eq('user_id', userId).not('deleted_at', 'is', null).select('id').maybeSingle()
  redirectWithNotice(returnTo, error || !data ? 'save-failed' : 'session-purged')
}

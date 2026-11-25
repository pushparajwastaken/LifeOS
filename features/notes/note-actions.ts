'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOwnedQuest } from '@/features/quests/quest-service'
import { NOTE_TYPES, QUEST_NOTE_TYPE, noteInputSchema, noteInputToRow } from './note-domain'
import { getOwnedNote } from './note-service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formString(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Only internal quest and knowledge paths are accepted as redirect targets (no open redirects). */
function safeReturnPath(value: string, fallback: string): string {
  if (value === '/knowledge') return value
  const match = /^\/(quests|knowledge)\/([0-9a-f-]{36})$/i.exec(value)
  return match && UUID.test(match[2]) ? value : fallback
}

function redirectWithNotice(path: string, notice: string): never {
  revalidatePath('/knowledge')
  revalidatePath('/quests')
  if (path !== '/knowledge') revalidatePath(path)
  redirect(`${path}?notice=${notice}`)
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id }
}

function readNoteInput(formData: FormData) {
  const noteType = formString(formData, 'noteType') || QUEST_NOTE_TYPE
  return noteInputSchema.safeParse({
    title: formString(formData, 'title'),
    noteType: (NOTE_TYPES as readonly string[]).includes(noteType) ? noteType : '',
    body: formString(formData, 'body'),
    sourceUrl: formString(formData, 'sourceUrl'),
  })
}

export async function createNoteAction(formData: FormData): Promise<void> {
  const questId = formString(formData, 'questId')
  const returnTo = safeReturnPath(formString(formData, 'returnTo'), '/knowledge')
  const parsed = readNoteInput(formData)
  if (!parsed.success) redirectWithNotice(returnTo, 'input-invalid')
  const { supabase, userId } = await getContext()

  if (questId && !UUID.test(questId)) redirectWithNotice(returnTo, 'record-not-found')
  const quest = questId ? await getOwnedQuest(supabase, userId, questId) : null
  if (questId && !quest) redirectWithNotice(returnTo, 'record-not-found')

  const { data, error } = await supabase
    .from('knowledge_notes')
    .insert({ user_id: userId, ...noteInputToRow(parsed.data) })
    .select('id')
    .single()
  if (error || !data) redirectWithNotice(returnTo, 'save-failed')

  if (quest) {
    const { error: linkError } = await supabase.from('quest_notes').insert({ user_id: userId, quest_id: quest.id, note_id: data.id })
    // The note is kept either way; an unlinked note stays reachable from the Notes page.
    redirectWithNotice(returnTo, linkError ? 'note-created-unlinked' : 'note-created')
  }
  redirectWithNotice(`/knowledge/${data.id}`, 'note-created')
}

export async function updateNoteAction(formData: FormData): Promise<void> {
  const noteId = formString(formData, 'noteId')
  if (!UUID.test(noteId)) redirectWithNotice('/knowledge', 'record-not-found')
  const parsed = readNoteInput(formData)
  if (!parsed.success) redirectWithNotice(`/knowledge/${noteId}`, 'input-invalid')
  const { supabase, userId } = await getContext()
  const { data, error } = await supabase
    .from('knowledge_notes')
    .update({ ...noteInputToRow(parsed.data), updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()
  redirectWithNotice(`/knowledge/${noteId}`, error || !data ? 'save-failed' : 'note-updated')
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  const noteId = formString(formData, 'noteId')
  if (!UUID.test(noteId)) redirectWithNotice('/knowledge', 'record-not-found')
  if (formString(formData, 'confirm') !== 'delete') redirectWithNotice(`/knowledge/${noteId}`, 'delete-unconfirmed')
  const { supabase, userId } = await getContext()
  // Quest links cascade; quests themselves are unaffected.
  const { data, error } = await supabase.from('knowledge_notes').delete().eq('id', noteId).eq('user_id', userId).select('id').maybeSingle()
  if (error || !data) redirectWithNotice(`/knowledge/${noteId}`, 'save-failed')
  redirectWithNotice('/knowledge', 'note-deleted')
}

async function readLink(formData: FormData) {
  const noteId = formString(formData, 'noteId')
  const questId = formString(formData, 'questId')
  const returnTo = safeReturnPath(formString(formData, 'returnTo'), '/knowledge')
  if (!UUID.test(noteId) || !UUID.test(questId)) redirectWithNotice(returnTo, 'record-not-found')
  const context = await getContext()
  // Ownership is checked here and again by the (id, user_id) foreign keys.
  const [note, quest] = await Promise.all([
    getOwnedNote(context.supabase, context.userId, noteId),
    getOwnedQuest(context.supabase, context.userId, questId),
  ])
  if (!note || !quest) redirectWithNotice(returnTo, 'record-not-found')
  return { ...context, noteId, questId, returnTo }
}

export async function linkNoteToQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, noteId, questId, returnTo } = await readLink(formData)
  const { error } = await supabase.from('quest_notes').insert({ user_id: userId, quest_id: questId, note_id: noteId })
  redirectWithNotice(returnTo, !error ? 'note-linked' : error.code === '23505' ? 'note-already-linked' : 'save-failed')
}

export async function unlinkNoteFromQuestAction(formData: FormData): Promise<void> {
  const { supabase, userId, noteId, questId, returnTo } = await readLink(formData)
  const { error } = await supabase.from('quest_notes').delete().eq('quest_id', questId).eq('note_id', noteId).eq('user_id', userId)
  redirectWithNotice(returnTo, error ? 'save-failed' : 'note-unlinked')
}

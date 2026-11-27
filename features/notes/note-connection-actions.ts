'use server'

import { field, finish, pillarSession, requireId } from '@/features/pillars/pillar-actions-kit'
import { NOTE_RELATIONS, normalizeTagName, type NoteRelation } from './note-connections'
import { getOwnedNote } from './note-service'

async function ownedNote(formData: FormData) {
  const noteId = requireId(formData, 'noteId', '/knowledge')
  const session = await pillarSession()
  const note = await getOwnedNote(session.supabase, session.userId, noteId)
  if (!note) finish('/knowledge', 'record-not-found')
  return { ...session, note, path: `/knowledge/${note.id}` }
}

/** Adds a tag to the note, creating the tag (per user, case-insensitive) if it does not exist yet. */
export async function addNoteTagAction(formData: FormData): Promise<void> {
  const { supabase, userId, note, path } = await ownedNote(formData)
  const name = normalizeTagName(field(formData, 'tag'))
  if (!name) finish(path, 'tag-invalid', '#connections')
  const { data: existing } = await supabase.from('knowledge_tags').select('id').eq('user_id', userId).eq('name', name).maybeSingle()
  let tagId = existing?.id as string | undefined
  if (!tagId) {
    const { data, error } = await supabase.from('knowledge_tags').insert({ user_id: userId, name }).select('id').single()
    if (error || !data) finish(path, 'save-failed', '#connections')
    tagId = data.id
  }
  const { error } = await supabase.from('knowledge_note_tags').upsert({ user_id: userId, note_id: note.id, tag_id: tagId }, { onConflict: 'note_id,tag_id', ignoreDuplicates: true })
  finish(path, error ? 'save-failed' : 'tag-added', '#connections')
}

/** Removes a tag from this note; the tag is deleted too once no note uses it. */
export async function removeNoteTagAction(formData: FormData): Promise<void> {
  const { supabase, userId, note, path } = await ownedNote(formData)
  const tagId = requireId(formData, 'tagId', path)
  const { error } = await supabase.from('knowledge_note_tags').delete().eq('note_id', note.id).eq('tag_id', tagId).eq('user_id', userId)
  if (!error) {
    const { count } = await supabase.from('knowledge_note_tags').select('note_id', { count: 'exact', head: true }).eq('tag_id', tagId).eq('user_id', userId)
    if (count === 0) await supabase.from('knowledge_tags').delete().eq('id', tagId).eq('user_id', userId)
  }
  finish(path, error ? 'save-failed' : 'tag-removed', '#connections')
}

export async function linkNotesAction(formData: FormData): Promise<void> {
  const { supabase, userId, note, path } = await ownedNote(formData)
  const targetId = requireId(formData, 'targetId', path)
  const relation = field(formData, 'relation') as NoteRelation
  if (targetId === note.id || !(NOTE_RELATIONS as readonly string[]).includes(relation)) finish(path, 'note-link-invalid', '#connections')
  const target = await getOwnedNote(supabase, userId, targetId)
  if (!target) finish(path, 'record-not-found', '#connections')
  const { error } = await supabase.from('knowledge_links').upsert({ user_id: userId, source_note_id: note.id, target_note_id: target.id, relation_type: relation }, { onConflict: 'source_note_id,target_note_id,relation_type', ignoreDuplicates: true })
  finish(path, error ? 'save-failed' : 'notes-linked', '#connections')
}

/** Removes a link touching this note, whichever side created it. */
export async function unlinkNotesAction(formData: FormData): Promise<void> {
  const { supabase, userId, note, path } = await ownedNote(formData)
  const linkId = requireId(formData, 'linkId', path)
  const { error } = await supabase.from('knowledge_links').delete().eq('id', linkId).eq('user_id', userId).or(`source_note_id.eq.${note.id},target_note_id.eq.${note.id}`)
  finish(path, error ? 'save-failed' : 'notes-unlinked', '#connections')
}

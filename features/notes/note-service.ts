import type { createClient } from '@/lib/supabase/server'
import { normalizeSearchQuery, type NoteFilter, type NoteType } from './note-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type NoteQuestLink = { id: string; title: string }

export type NoteListItem = {
  id: string
  title: string
  note_type: NoteType
  body: string
  updated_at: string
  quests: NoteQuestLink[]
}

export type NoteListData = {
  notes: NoteListItem[]
  filter: NoteFilter
  query: string | null
  hasLoadError: boolean
  truncated: boolean
}

type NoteRow = {
  id: string
  title: string
  note_type: NoteType
  body: string
  updated_at: string
  quest_notes: Array<{ side_quests: NoteQuestLink | null }> | null
}

const LIST_LIMIT = 200

function mapNote(row: NoteRow): NoteListItem {
  return {
    id: row.id,
    title: row.title,
    note_type: row.note_type,
    body: row.body,
    updated_at: row.updated_at,
    quests: (row.quest_notes ?? []).map((link) => link.side_quests).filter((quest): quest is NoteQuestLink => quest !== null),
  }
}

export async function getNoteListData(supabase: Supabase, userId: string, filter: NoteFilter, rawQuery?: string): Promise<NoteListData> {
  const query = normalizeSearchQuery(rawQuery)
  let request = supabase
    .from('knowledge_notes')
    .select('id,title,note_type,body,updated_at,quest_notes(side_quests(id,title))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(LIST_LIMIT)
  if (query) request = request.textSearch('search_document', query, { type: 'websearch', config: 'english' })
  const { data, error } = await request
  const all = ((data ?? []) as unknown as NoteRow[]).map(mapNote)
  const notes = filter === 'linked'
    ? all.filter((note) => note.quests.length > 0)
    : filter === 'unlinked'
      ? all.filter((note) => note.quests.length === 0)
      : all
  return { notes, filter, query, hasLoadError: Boolean(error), truncated: all.length >= LIST_LIMIT }
}

export type NoteDetail = {
  id: string
  title: string
  note_type: NoteType
  body: string
  source_url: string | null
  created_at: string
  updated_at: string
}

export async function getOwnedNote(supabase: Supabase, userId: string, noteId: string): Promise<NoteDetail | null> {
  const { data, error } = await supabase
    .from('knowledge_notes')
    .select('id,title,note_type,body,source_url,created_at,updated_at')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as NoteDetail
}

export type NoteDetailData = {
  note: NoteDetail
  linkedQuests: NoteQuestLink[]
  questOptions: NoteQuestLink[]
  hasLoadError: boolean
}

export async function getNoteDetailData(supabase: Supabase, userId: string, noteId: string): Promise<NoteDetailData | null> {
  const note = await getOwnedNote(supabase, userId, noteId)
  if (!note) return null
  const [linkResult, questResult] = await Promise.all([
    supabase.from('quest_notes').select('side_quests(id,title)').eq('note_id', noteId).eq('user_id', userId),
    supabase.from('side_quests').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false }).limit(200),
  ])
  const linkedQuests = ((linkResult.data ?? []) as unknown as Array<{ side_quests: NoteQuestLink | null }>)
    .map((row) => row.side_quests)
    .filter((quest): quest is NoteQuestLink => quest !== null)
  const linkedIds = new Set(linkedQuests.map((quest) => quest.id))
  const questOptions = ((questResult.data ?? []) as NoteQuestLink[]).filter((quest) => !linkedIds.has(quest.id))
  return { note, linkedQuests, questOptions, hasLoadError: Boolean(linkResult.error || questResult.error) }
}

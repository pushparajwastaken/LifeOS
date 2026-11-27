import type { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export const NOTE_RELATIONS = ['related', 'supports', 'contrasts', 'extends', 'inspired_by'] as const
export type NoteRelation = (typeof NOTE_RELATIONS)[number]
/** How a link reads from the note that created it, and from the other side. */
export const RELATION_LABELS: Record<NoteRelation, { outgoing: string; incoming: string }> = {
  related: { outgoing: 'Related to', incoming: 'Related to' },
  supports: { outgoing: 'Supports', incoming: 'Supported by' },
  contrasts: { outgoing: 'Contrasts with', incoming: 'Contrasts with' },
  extends: { outgoing: 'Extends', incoming: 'Extended by' },
  inspired_by: { outgoing: 'Inspired by', incoming: 'Inspired' },
}
export const TAG_MAX = 60

export type NoteConnections = {
  tags: Array<{ id: string; name: string }>
  tagSuggestions: string[]
  links: Array<{ id: string; noteId: string; title: string; label: string; outgoing: boolean }>
  linkable: Array<{ id: string; title: string }>
  books: Array<{ id: string; title: string }>
  hasLoadError: boolean
}

/** Tags, note-to-note links (both directions) and linked books for one note the user owns. */
export async function getNoteConnections(supabase: Supabase, userId: string, noteId: string): Promise<NoteConnections> {
  const [tagRows, allTags, outgoing, incoming, notes, books] = await Promise.all([
    supabase.from('knowledge_note_tags').select('tag_id,knowledge_tags(id,name)').eq('user_id', userId).eq('note_id', noteId).limit(100),
    supabase.from('knowledge_tags').select('name').eq('user_id', userId).order('name', { ascending: true }).limit(500),
    supabase.from('knowledge_links').select('id,relation_type,target_note_id,knowledge_notes!knowledge_links_target_owner_fk(id,title)').eq('user_id', userId).eq('source_note_id', noteId).limit(200),
    supabase.from('knowledge_links').select('id,relation_type,source_note_id,knowledge_notes!knowledge_links_source_owner_fk(id,title)').eq('user_id', userId).eq('target_note_id', noteId).limit(200),
    supabase.from('knowledge_notes').select('id,title').eq('user_id', userId).neq('id', noteId).order('updated_at', { ascending: false }).limit(300),
    supabase.from('knowledge_book_links').select('book_id,books(id,title)').eq('user_id', userId).eq('note_id', noteId).limit(100),
  ])
  const tags = ((tagRows.data ?? []) as unknown as Array<{ knowledge_tags: { id: string; name: string } | null }>).flatMap((row) => (row.knowledge_tags ? [row.knowledge_tags] : [])).sort((a, b) => a.name.localeCompare(b.name))
  const own = new Set(tags.map((tag) => tag.name))
  type Linked = { id: string; relation_type: NoteRelation; knowledge_notes: { id: string; title: string } | null }
  const links = [
    ...((outgoing.data ?? []) as unknown as Linked[]).flatMap((row) => (row.knowledge_notes ? [{ id: row.id, noteId: row.knowledge_notes.id, title: row.knowledge_notes.title, label: RELATION_LABELS[row.relation_type]?.outgoing ?? 'Related to', outgoing: true }] : [])),
    ...((incoming.data ?? []) as unknown as Linked[]).flatMap((row) => (row.knowledge_notes ? [{ id: row.id, noteId: row.knowledge_notes.id, title: row.knowledge_notes.title, label: RELATION_LABELS[row.relation_type]?.incoming ?? 'Related to', outgoing: false }] : [])),
  ]
  return {
    tags,
    tagSuggestions: ((allTags.data ?? []) as Array<{ name: string }>).map((tag) => tag.name).filter((name) => !own.has(name)),
    links,
    linkable: (notes.data ?? []) as Array<{ id: string; title: string }>,
    books: ((books.data ?? []) as unknown as Array<{ books: { id: string; title: string } | null }>).flatMap((row) => (row.books ? [row.books] : [])),
    hasLoadError: [tagRows, allTags, outgoing, incoming, notes, books].some((result) => Boolean(result.error)),
  }
}

/** Tag names are trimmed, inner whitespace collapsed, and compared case-insensitively by lower-casing. */
export function normalizeTagName(value: string): string | null {
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return name && name.length <= TAG_MAX ? name : null
}

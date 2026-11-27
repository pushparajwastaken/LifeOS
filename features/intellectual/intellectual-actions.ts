'use server'

import { field, finish, pillarSession, requireId } from '@/features/pillars/pillar-actions-kit'
import { BOOK_STATUSES, bookInputSchema, readingSessionSchema, statusDates, type BookStatus } from './intellectual-domain'
import { getOwnedBook } from './intellectual-service'

const HOME = '/intellectual'

function parseBook(formData: FormData) {
  return bookInputSchema.safeParse({ title: field(formData, 'title'), author: field(formData, 'author'), totalPages: field(formData, 'totalPages'), status: field(formData, 'status') || 'to_read' })
}

/** Loads the book named in the form and checks the signed-in user owns it. */
async function ownedBook(formData: FormData, fallback = HOME) {
  const bookId = requireId(formData, 'bookId', fallback)
  const session = await pillarSession()
  const book = await getOwnedBook(session.supabase, session.userId, bookId)
  if (!book) finish(fallback, 'record-not-found')
  return { ...session, book, path: `${HOME}/books/${book.id}` }
}

export async function createBookAction(formData: FormData): Promise<void> {
  const parsed = parseBook(formData)
  if (!parsed.success) finish(HOME, 'book-invalid', '#add-book')
  const { supabase, userId, today } = await pillarSession()
  const dates = statusDates(parsed.data.status, { started_on: null, finished_on: null }, today)
  const { error } = await supabase.from('books').insert({ user_id: userId, title: parsed.data.title, author: parsed.data.author, total_pages: parsed.data.totalPages, status: parsed.data.status, ...dates })
  finish(HOME, error ? 'save-failed' : 'book-added')
}

export async function updateBookAction(formData: FormData): Promise<void> {
  const { supabase, userId, book, path } = await ownedBook(formData)
  const parsed = parseBook(formData)
  if (!parsed.success) finish(path, 'book-invalid')
  const { error } = await supabase.from('books').update({ title: parsed.data.title, author: parsed.data.author, total_pages: parsed.data.totalPages }).eq('id', book.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'book-updated')
}

export async function setBookStatusAction(formData: FormData): Promise<void> {
  const returnTo = field(formData, 'returnTo') === 'list' ? HOME : null
  const { supabase, userId, book, path, today } = await ownedBook(formData)
  const status = field(formData, 'status') as BookStatus
  if (!(BOOK_STATUSES as readonly string[]).includes(status)) finish(returnTo ?? path, 'record-not-found')
  if (book.status === status) finish(returnTo ?? path, `book-${status}`)
  const { error } = await supabase.from('books').update({ status, ...statusDates(status, book, today) }).eq('id', book.id).eq('user_id', userId).eq('status', book.status)
  finish(returnTo ?? path, error ? 'save-failed' : `book-${status}`)
}

export async function deleteBookAction(formData: FormData): Promise<void> {
  const { supabase, userId, book, path } = await ownedBook(formData)
  if (field(formData, 'confirm') !== 'delete') finish(path, 'delete-confirm', '#delete')
  const { error } = await supabase.from('books').delete().eq('id', book.id).eq('user_id', userId)
  finish(error ? path : HOME, error ? 'save-failed' : 'book-deleted')
}

export async function logReadingAction(formData: FormData): Promise<void> {
  const fromList = field(formData, 'returnTo') === 'list'
  const { supabase, userId, book, path, today } = await ownedBook(formData)
  const back = fromList ? HOME : path
  const parsed = readingSessionSchema.safeParse({ date: field(formData, 'date') || today, pages: field(formData, 'pages'), minutes: field(formData, 'minutes'), notes: field(formData, 'notes') })
  if (!parsed.success || parsed.data.date > today) finish(back, 'reading-invalid')
  const { error } = await supabase.from('reading_sessions').insert({ user_id: userId, book_id: book.id, session_date: parsed.data.date, pages_read: parsed.data.pages, duration_minutes: parsed.data.minutes, notes: parsed.data.notes })
  // Logging reading on a book you hadn't started moves it to "Reading".
  if (!error && (book.status === 'to_read' || book.status === 'paused')) {
    await supabase.from('books').update({ status: 'reading', ...statusDates('reading', book, today) }).eq('id', book.id).eq('user_id', userId)
  }
  finish(back, error ? 'save-failed' : 'reading-logged')
}

export async function deleteReadingAction(formData: FormData): Promise<void> {
  const fromList = field(formData, 'returnTo') === 'list'
  const sessionId = requireId(formData, 'sessionId', HOME)
  const { supabase, userId } = await pillarSession()
  const { data, error } = await supabase.from('reading_sessions').delete().eq('id', sessionId).eq('user_id', userId).select('book_id').maybeSingle()
  const back = fromList || !data ? HOME : `${HOME}/books/${(data as { book_id: string }).book_id}`
  finish(back, error ? 'save-failed' : data ? 'reading-deleted' : 'record-not-found')
}

export async function linkNoteToBookAction(formData: FormData): Promise<void> {
  const { supabase, userId, book, path } = await ownedBook(formData)
  const noteId = requireId(formData, 'noteId', path)
  const { data: note } = await supabase.from('knowledge_notes').select('id').eq('id', noteId).eq('user_id', userId).maybeSingle()
  if (!note) finish(path, 'record-not-found')
  const { error } = await supabase.from('knowledge_book_links').upsert({ user_id: userId, note_id: noteId, book_id: book.id }, { onConflict: 'note_id,book_id', ignoreDuplicates: true })
  finish(path, error ? 'save-failed' : 'book-note-linked', '#notes')
}

export async function unlinkNoteFromBookAction(formData: FormData): Promise<void> {
  const { supabase, userId, book, path } = await ownedBook(formData)
  const noteId = requireId(formData, 'noteId', path)
  const { error } = await supabase.from('knowledge_book_links').delete().eq('note_id', noteId).eq('book_id', book.id).eq('user_id', userId)
  finish(path, error ? 'save-failed' : 'book-note-unlinked', '#notes')
}

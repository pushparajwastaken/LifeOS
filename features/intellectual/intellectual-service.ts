import type { createClient } from '@/lib/supabase/server'
import { weekWindow, countByWeek, sumByWeek } from '@/features/analytics/analytics-domain'
import { bookProgress, type BookProgress, type BookStatus } from './intellectual-domain'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type BookRow = { id: string; title: string; author: string | null; total_pages: number | null; status: BookStatus; started_on: string | null; finished_on: string | null; updated_at: string }
export type ReadingRow = { id: string; book_id: string; session_date: string; pages_read: number; duration_minutes: number | null; notes: string | null }
export type BookView = BookRow & { progress: BookProgress; lastRead: string | null }

const BOOK_SELECT = 'id,title,author,total_pages,status,started_on,finished_on,updated_at'
const SESSION_SELECT = 'id,book_id,session_date,pages_read,duration_minutes,notes'
export const INTELLECTUAL_WEEKS = 8

export async function getIntellectualData(supabase: Supabase, userId: string, today: string) {
  const weeks = weekWindow(today, INTELLECTUAL_WEEKS)
  const [bookResult, sessionResult, noteCount] = await Promise.all([
    supabase.from('books').select(BOOK_SELECT).eq('user_id', userId).order('updated_at', { ascending: false }).limit(500),
    supabase.from('reading_sessions').select(SESSION_SELECT).eq('user_id', userId).order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
    supabase.from('knowledge_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ])
  const sessions = (sessionResult.data ?? []) as ReadingRow[]
  const pagesByBook = new Map<string, number>()
  const lastReadByBook = new Map<string, string>()
  for (const session of sessions) {
    pagesByBook.set(session.book_id, (pagesByBook.get(session.book_id) ?? 0) + session.pages_read)
    if (!lastReadByBook.has(session.book_id)) lastReadByBook.set(session.book_id, session.session_date)
  }
  const books: BookView[] = ((bookResult.data ?? []) as BookRow[]).map((book) => ({
    ...book,
    progress: bookProgress(book.total_pages, pagesByBook.get(book.id) ?? 0, book.status),
    lastRead: lastReadByBook.get(book.id) ?? null,
  }))
  const thisWeek = weeks[weeks.length - 1]
  const weekSessions = sessions.filter((session) => session.session_date >= thisWeek && session.session_date <= today)
  const year = today.slice(0, 4)
  return {
    books,
    recent: sessions.filter((session) => session.session_date >= weeks[weeks.length - 2]).slice(0, 40),
    titles: new Map(books.map((book) => [book.id, book.title])),
    weeks,
    pagesSeries: sumByWeek(sessions.map((session) => ({ date: session.session_date, value: session.pages_read })), weeks, today),
    daysSeries: countByWeek([...new Set(sessions.map((session) => session.session_date))], weeks, today),
    thisWeek: {
      pages: weekSessions.reduce((sum, session) => sum + session.pages_read, 0),
      minutes: weekSessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0),
      days: new Set(weekSessions.map((session) => session.session_date)).size,
    },
    finishedThisYear: books.filter((book) => book.status === 'completed' && book.finished_on?.startsWith(year)).length,
    noteCount: noteCount.count ?? 0,
    truncated: sessions.length >= 5000,
    hasLoadError: Boolean(bookResult.error || sessionResult.error || noteCount.error),
  }
}

export async function getOwnedBook(supabase: Supabase, userId: string, bookId: string): Promise<BookRow | null> {
  const { data, error } = await supabase.from('books').select(BOOK_SELECT).eq('id', bookId).eq('user_id', userId).maybeSingle()
  return error || !data ? null : (data as BookRow)
}

export async function getBookDetail(supabase: Supabase, userId: string, bookId: string) {
  const book = await getOwnedBook(supabase, userId, bookId)
  if (!book) return null
  const [sessionResult, linkResult, noteResult] = await Promise.all([
    supabase.from('reading_sessions').select(SESSION_SELECT).eq('user_id', userId).eq('book_id', bookId).order('session_date', { ascending: false }).limit(1000),
    supabase.from('knowledge_book_links').select('note_id,knowledge_notes(id,title,note_type)').eq('user_id', userId).eq('book_id', bookId).limit(200),
    supabase.from('knowledge_notes').select('id,title').eq('user_id', userId).order('updated_at', { ascending: false }).limit(300),
  ])
  const sessions = (sessionResult.data ?? []) as ReadingRow[]
  const linked = ((linkResult.data ?? []) as unknown as Array<{ note_id: string; knowledge_notes: { id: string; title: string; note_type: string } | null }>)
    .flatMap((row) => (row.knowledge_notes ? [row.knowledge_notes] : []))
  const linkedIds = new Set(linked.map((note) => note.id))
  const pagesRead = sessions.reduce((sum, session) => sum + session.pages_read, 0)
  return {
    book,
    progress: bookProgress(book.total_pages, pagesRead, book.status),
    sessions,
    minutes: sessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0),
    linkedNotes: linked,
    linkableNotes: ((noteResult.data ?? []) as Array<{ id: string; title: string }>).filter((note) => !linkedIds.has(note.id)),
    hasLoadError: Boolean(sessionResult.error || linkResult.error || noteResult.error),
  }
}

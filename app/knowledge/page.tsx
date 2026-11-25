import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { NoteOverview } from '@/features/notes/components/note-overview'
import { parseNoteFilter } from '@/features/notes/note-domain'
import { getNoteListData } from '@/features/notes/note-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Knowledge vault',
  description: 'Your notes, ideas and explanations, linked to the side quests they support.',
}

type PageProps = { searchParams: Promise<{ filter?: string | string[]; q?: string | string[]; notice?: string | string[] }> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function KnowledgePage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const data = await getNoteListData(session.supabase, session.userId, parseNoteFilter(first(params.filter)), first(params.q))
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <NoteOverview data={data} timeZone={session.timeZone} notice={first(params.notice)} />
    </AppShell>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { NoteDetail } from '@/features/notes/components/note-detail'
import { getNoteDetailData } from '@/features/notes/note-service'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Note',
  description: 'A note in your knowledge vault.',
}

type PageProps = { params: Promise<{ noteId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function NoteDetailPage({ params, searchParams }: PageProps) {
  const [{ noteId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(noteId).success) notFound()
  const data = await getNoteDetailData(session.supabase, session.userId, noteId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <NoteDetail data={data} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

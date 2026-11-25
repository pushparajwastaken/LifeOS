import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { QuestDetail } from '@/features/quests/components/quest-detail'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getQuestDetailData } from '@/features/quests/quest-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Side Quest',
  description: 'Objectives, milestones and notes for one side quest.',
}

type PageProps = {
  params: Promise<{ questId: string }>
  searchParams: Promise<{ notice?: string | string[]; noteQuery?: string | string[] }>
}

export default async function QuestDetailPage({ params, searchParams }: PageProps) {
  const [{ questId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(questId).success) notFound()
  const noteQuery = Array.isArray(search.noteQuery) ? search.noteQuery[0] : search.noteQuery
  const data = await getQuestDetailData(session.supabase, session.userId, questId, noteQuery)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <QuestDetail data={data} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

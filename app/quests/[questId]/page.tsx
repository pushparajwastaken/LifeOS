import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { QuestDetail } from '@/features/quests/components/quest-detail'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getQuestDetailData } from '@/features/quests/quest-service'
import { getQuestSessionSummary } from '@/features/learning/learning-service'
import { getQuestResources } from '@/features/resources/resource-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Side Quest',
  description: 'Objectives, milestones and notes for one side quest.',
}

type PageProps = {
  params: Promise<{ questId: string }>
  searchParams: Promise<{ notice?: string | string[]; noteQuery?: string | string[]; undo?: string | string[] }>
}

export default async function QuestDetailPage({ params, searchParams }: PageProps) {
  const [{ questId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(questId).success) notFound()
  const noteQuery = Array.isArray(search.noteQuery) ? search.noteQuery[0] : search.noteQuery
  const data = await getQuestDetailData(session.supabase, session.userId, questId, noteQuery)
  if (!data) notFound()
  const [sessions, resources] = await Promise.all([
    getQuestSessionSummary(session.supabase, session.userId, questId, data.quest.title, session.timeZone),
    getQuestResources(session.supabase, session.userId, questId),
  ])
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  const undoId = Array.isArray(search.undo) ? search.undo[0] : search.undo
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <QuestDetail data={data} sessions={sessions} resources={resources} timeZone={session.timeZone} notice={notice} undoId={undoId && uuidSchema.safeParse(undoId).success ? undoId : undefined} />
    </AppShell>
  )
}

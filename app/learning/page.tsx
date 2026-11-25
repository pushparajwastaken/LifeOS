import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { LearningLog } from '@/features/learning/components/learning-log'
import { getLearningLogData } from '@/features/learning/learning-service'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Learning log',
  description: 'Your learning sessions: the time you actually spent studying, practising and building.',
}

type PageProps = { searchParams: Promise<{ notice?: string | string[]; undo?: string | string[] }> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function LearningPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const data = await getLearningLogData(session.supabase, session.userId, session.timeZone)
  const undo = first(params.undo)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <LearningLog data={data} timeZone={session.timeZone} notice={first(params.notice)} undoId={undo && uuidSchema.safeParse(undo).success ? undo : undefined} />
    </AppShell>
  )
}

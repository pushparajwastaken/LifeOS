import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { GoalDetail } from '@/features/goals/components/goal-detail'
import { getGoalDetail } from '@/features/goals/goal-service'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Goal',
  description: 'Progress readings, milestones and details for one goal.',
}

type PageProps = { params: Promise<{ goalId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function GoalPage({ params, searchParams }: PageProps) {
  const [{ goalId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(goalId).success) notFound()
  const data = await getGoalDetail(session.supabase, session.userId, goalId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <GoalDetail data={data} today={getLocalDateKey(new Date(), session.timeZone)} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

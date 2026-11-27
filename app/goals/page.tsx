import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { GoalsList } from '@/features/goals/components/goals-list'
import { getGoalsList, parseGoalsFilter } from '@/features/goals/goal-service'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Goals',
  description: 'Longer-term goals with a time frame, a target or milestones, and an honest history of progress.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function GoalsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const filter = parseGoalsFilter(first(params.status))
  const data = await getGoalsList(session.supabase, session.userId, filter)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <GoalsList data={data} filter={filter} today={getLocalDateKey(new Date(), session.timeZone)} notice={first(params.notice)} />
    </AppShell>
  )
}

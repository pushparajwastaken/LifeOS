import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { DailyPlanner } from '@/features/planner/components/daily-planner'
import { parsePlannerDate } from '@/features/planner/planner-domain'
import { getPlannerData } from '@/features/planner/planner-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Daily planner',
  description: 'Plan a day from your tasks, see its habits and learning, and close it with a short review.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function PlannerPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const today = getLocalDateKey(new Date(), session.timeZone)
  const date = parsePlannerDate(first(params.date), today)
  const data = await getPlannerData(session.supabase, session.userId, date, today, session.timeZone)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <DailyPlanner data={data} today={today} timeZone={session.timeZone} notice={first(params.notice)} />
    </AppShell>
  )
}

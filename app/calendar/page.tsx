import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { CalendarMonth } from '@/features/calendar/components/calendar-month'
import { parseMonth, parseSelectedDay } from '@/features/calendar/calendar-view-domain'
import { getCalendarMonth } from '@/features/calendar/calendar-view-service'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Calendar',
  description: 'A month of tasks, learning, training and goal dates in one view.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function CalendarPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const today = getLocalDateKey(new Date(), session.timeZone)
  const month = parseMonth(first(params.month), today)
  const day = parseSelectedDay(first(params.day), month, today)
  const data = await getCalendarMonth(session.supabase, session.userId, month, session.timeZone)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <CalendarMonth month={month} day={day} today={today} timeZone={session.timeZone} data={data} />
    </AppShell>
  )
}

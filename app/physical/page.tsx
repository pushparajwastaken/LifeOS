import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { utcToZonedParts } from '@/features/learning/learning-domain'
import { PhysicalOverview } from '@/features/physical/components/physical-overview'
import { getPhysicalData } from '@/features/physical/physical-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Physical',
  description: 'Workouts, runs, sleep and body weight, with eight weeks of history.',
}

type PageProps = { searchParams: Promise<{ notice?: string | string[] }> }

export default async function PhysicalPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const today = getLocalDateKey(new Date(), session.timeZone)
  const data = await getPhysicalData(session.supabase, session.userId, today, session.timeZone)
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <PhysicalOverview data={data} today={today} timeZone={session.timeZone} nowTime={utcToZonedParts(new Date().toISOString(), session.timeZone).time} notice={notice} />
    </AppShell>
  )
}

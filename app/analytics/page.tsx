import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { AnalyticsOverview } from '@/features/analytics/components/analytics-overview'
import { getAnalyticsData } from '@/features/analytics/analytics-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Patterns across productivity, habits, learning and your library, without reducing growth to one score.',
}

export default async function AnalyticsPage() {
  const session = await getPageSession()
  const data = await getAnalyticsData(session.supabase, session.userId)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <AnalyticsOverview data={data} />
    </AppShell>
  )
}

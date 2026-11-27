import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { CommunicationOverview } from '@/features/communication/components/communication-overview'
import { getCommunicationData } from '@/features/communication/communication-service'
import { utcToZonedParts } from '@/features/learning/learning-domain'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'

export const metadata: Metadata = { title: 'Communication', description: 'Speaking practice and a video pipeline.' }

type PageProps = { searchParams: Promise<{ notice?: string | string[] }> }

export default async function CommunicationPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([pillarSession(), searchParams])
  const data = await getCommunicationData(session.supabase, session.userId, session.today, session.timeZone)
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <CommunicationOverview data={data} today={session.today} timeZone={session.timeZone} nowTime={utcToZonedParts(new Date().toISOString(), session.timeZone).time} notice={notice} />
    </AppShell>
  )
}

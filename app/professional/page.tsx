import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { utcToZonedParts } from '@/features/learning/learning-domain'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'
import { ProfessionalOverview } from '@/features/professional/components/professional-overview'
import { PROJECT_STATUSES, type ProjectStatus } from '@/features/professional/professional-domain'
import { getProfessionalData } from '@/features/professional/professional-service'

export const metadata: Metadata = { title: 'Professional', description: 'Projects, building time, shipped work and problem-solving practice.' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ProfessionalPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([pillarSession(), searchParams])
  const raw = first(params.status)
  const filter = raw && (PROJECT_STATUSES as readonly string[]).includes(raw) ? (raw as ProjectStatus) : 'all'
  const data = await getProfessionalData(session.supabase, session.userId, session.today, session.timeZone)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <ProfessionalOverview data={data} filter={filter} today={session.today} timeZone={session.timeZone} nowTime={utcToZonedParts(new Date().toISOString(), session.timeZone).time} notice={first(params.notice)} />
    </AppShell>
  )
}

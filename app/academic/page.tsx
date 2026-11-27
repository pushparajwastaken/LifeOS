import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { AcademicOverview } from '@/features/academic/components/academic-overview'
import { getAcademicOverview } from '@/features/academic/academic-service'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'

export const metadata: Metadata = { title: 'Academic', description: 'Subjects, topics, spaced revision, assessments and an error log.' }

type PageProps = { searchParams: Promise<{ notice?: string | string[] }> }

export default async function AcademicPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([pillarSession(), searchParams])
  const data = await getAcademicOverview(session.supabase, session.userId, session.today, session.timeZone)
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <AcademicOverview data={data} notice={notice} />
    </AppShell>
  )
}

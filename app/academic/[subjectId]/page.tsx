import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { SubjectDetail } from '@/features/academic/components/subject-detail'
import { getSubjectDetail } from '@/features/academic/academic-service'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'
import { uuidSchema } from '@/features/quests/quest-domain'

export const metadata: Metadata = { title: 'Subject', description: 'Topics, revision cards, assessments and mistakes for one subject.' }

type PageProps = { params: Promise<{ subjectId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function SubjectPage({ params, searchParams }: PageProps) {
  const [{ subjectId }, search, session] = await Promise.all([params, searchParams, pillarSession()])
  if (!uuidSchema.safeParse(subjectId).success) notFound()
  const data = await getSubjectDetail(session.supabase, session.userId, subjectId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <SubjectDetail data={data} today={session.today} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

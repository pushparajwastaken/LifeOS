import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { utcToZonedParts } from '@/features/learning/learning-domain'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'
import { ProjectDetail } from '@/features/professional/components/project-detail'
import { getProjectDetail } from '@/features/professional/professional-service'
import { uuidSchema } from '@/features/quests/quest-domain'

export const metadata: Metadata = { title: 'Project', description: 'Milestones, tasks, building time and shipped work for one project.' }

type PageProps = { params: Promise<{ projectId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const [{ projectId }, search, session] = await Promise.all([params, searchParams, pillarSession()])
  if (!uuidSchema.safeParse(projectId).success) notFound()
  const data = await getProjectDetail(session.supabase, session.userId, projectId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <ProjectDetail data={data} today={session.today} timeZone={session.timeZone} nowTime={utcToZonedParts(new Date().toISOString(), session.timeZone).time} notice={notice} />
    </AppShell>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { ResourceDetail } from '@/features/resources/components/resource-detail'
import { getResourceDetailData } from '@/features/resources/resource-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Resource',
  description: 'A resource in your library: status, quests, learning sessions and provenance.',
}

type PageProps = { params: Promise<{ resourceId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function ResourcePage({ params, searchParams }: PageProps) {
  const [{ resourceId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(resourceId).success) notFound()
  const data = await getResourceDetailData(session.supabase, session.userId, resourceId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <ResourceDetail data={data} timeZone={session.timeZone} today={getLocalDateKey(new Date(), session.timeZone)} notice={notice} />
    </AppShell>
  )
}

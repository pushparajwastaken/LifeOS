import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { ImportReview } from '@/features/imports/components/import-review'
import { getImportRunData } from '@/features/imports/import-service'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Review import',
  description: 'Choose which bookmarks to import into your library.',
}

type PageProps = { params: Promise<{ runId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function ImportRunPage({ params, searchParams }: PageProps) {
  const [{ runId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(runId).success) notFound()
  const data = await getImportRunData(session.supabase, session.userId, runId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <ImportReview data={data} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

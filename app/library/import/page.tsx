import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { ImportHome } from '@/features/imports/components/import-home'
import { getImportHistory } from '@/features/imports/import-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Import bookmarks',
  description: 'Import browser bookmarks into your library after reviewing them.',
}

type PageProps = { searchParams: Promise<{ notice?: string | string[] }> }

export default async function ImportPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const history = await getImportHistory(session.supabase, session.userId)
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <ImportHome runs={history.runs} hasLoadError={history.hasLoadError} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

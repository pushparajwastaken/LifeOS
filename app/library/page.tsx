import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { LibraryOverview } from '@/features/resources/components/library-overview'
import { parseResourceFilters } from '@/features/resources/resource-domain'
import { getLibraryData } from '@/features/resources/resource-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Library',
  description: 'Articles, videos, papers and courses you want to learn from, attached to your side quests.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function LibraryPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const filters = parseResourceFilters({ status: first(params.status), type: first(params.type), quest: first(params.quest), q: first(params.q) })
  const data = await getLibraryData(session.supabase, session.userId, filters)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <LibraryOverview data={data} filters={filters} notice={first(params.notice)} />
    </AppShell>
  )
}

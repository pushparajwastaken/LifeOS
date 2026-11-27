import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { IntellectualOverview } from '@/features/intellectual/components/intellectual-overview'
import { BOOK_STATUSES, type BookStatus } from '@/features/intellectual/intellectual-domain'
import { getIntellectualData } from '@/features/intellectual/intellectual-service'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'

export const metadata: Metadata = { title: 'Intellectual', description: 'Books, reading sessions and notes.' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function IntellectualPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([pillarSession(), searchParams])
  const raw = first(params.status)
  const filter = raw && (BOOK_STATUSES as readonly string[]).includes(raw) ? (raw as BookStatus) : 'all'
  const data = await getIntellectualData(session.supabase, session.userId, session.today)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <IntellectualOverview data={data} filter={filter} today={session.today} notice={first(params.notice)} />
    </AppShell>
  )
}

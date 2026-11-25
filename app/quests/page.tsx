import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { QuestOverview } from '@/features/quests/components/quest-overview'
import { parseQuestFilter } from '@/features/quests/quest-domain'
import { getQuestListData } from '@/features/quests/quest-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Side Quests',
  description: 'The skills and capabilities you are developing, structured or exploratory.',
}

type PageProps = { searchParams: Promise<{ status?: string | string[]; notice?: string | string[] }> }

export default async function QuestsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const filter = parseQuestFilter(Array.isArray(params.status) ? params.status[0] : params.status)
  const data = await getQuestListData(session.supabase, session.userId, filter)
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <QuestOverview data={data} filter={filter} notice={notice} />
    </AppShell>
  )
}

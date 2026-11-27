import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { TasksPage } from '@/features/tasks/components/tasks-page'
import { parseTaskFilters } from '@/features/tasks/task-domain'
import { getTasksPageData } from '@/features/tasks/task-service'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Tasks',
  description: 'Every task in one place: due dates, priorities, search and an honest history of what got done.',
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function TasksRoute({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getPageSession(), searchParams])
  const filters = parseTaskFilters({ view: first(params.view), pillar: first(params.pillar), q: first(params.q) })
  const data = await getTasksPageData(session.supabase, session.userId, filters, session.timeZone)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <TasksPage data={data} filters={filters} today={getLocalDateKey(new Date(), session.timeZone)} timeZone={session.timeZone} notice={first(params.notice)} />
    </AppShell>
  )
}

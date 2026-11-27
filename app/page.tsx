import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview'
import { getDashboardData } from '@/features/dashboard/dashboard-service'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Overview',
  description: 'A calm daily view of your tasks, habits, goals, and five areas of growth.',
}

const noticeMessages: Record<string, string> = {
  'task-added': 'Your task was added to the queue.',
  'task-completed': 'Task marked complete.',
  'task-completed-repeat': 'Task marked complete. The next one has been added.',
  'habit-created': 'Your new habit is ready for a check-in.',
  'habit-saved': 'Today’s habit check-in was saved.',
  'habit-cleared': 'Today’s habit check-in was cleared.',
  'input-required': 'Check the form details and try again.',
  'record-not-found': 'That record could not be updated. Refresh and try again.',
  'save-failed': 'That change could not be saved. Please try again.',
}

type PageProps = {
  searchParams: Promise<{ notice?: string | string[] }>
}

export default async function Page({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [data, params] = await Promise.all([
    getDashboardData(supabase, user.id),
    searchParams,
  ])
  const rawNotice = Array.isArray(params.notice) ? params.notice[0] : params.notice
  const metadataName = user.user_metadata?.display_name
  const fallbackName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : 'Your space'
  const userName = data.profileName && data.profileName !== 'Your space'
    ? data.profileName
    : fallbackName

  return (
    <AppShell userName={userName} userEmail={user.email ?? ''}>
      <DashboardOverview data={data} notice={rawNotice ? noticeMessages[rawNotice] : undefined} />
    </AppShell>
  )
}

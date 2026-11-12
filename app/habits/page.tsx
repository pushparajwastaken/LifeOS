import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { HabitOverview } from '@/features/habits/components/habit-overview'
import { getHabitManagementData } from '@/features/habits/habit-service'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Habits',
  description: 'Design sustainable routines, learn from missed opportunities, and understand your saved consistency patterns.',
}

type PageProps = {
  searchParams: Promise<{ notice?: string | string[] }>
}

export default async function HabitsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [data, params] = await Promise.all([
    getHabitManagementData(supabase, user.id),
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
      <HabitOverview data={data} notice={rawNotice} />
    </AppShell>
  )
}

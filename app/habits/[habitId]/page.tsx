import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { HabitDetail } from '@/features/habits/components/habit-detail'
import { getHabitDetailData } from '@/features/habits/habit-service'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Habit detail',
  description: 'Review a habit’s schedule, saved progress, behavior design, and recovery experiments.',
}

type PageProps = {
  params: Promise<{ habitId: string }>
  searchParams: Promise<{ notice?: string | string[] }>
}

export default async function HabitDetailPage({ params, searchParams }: PageProps) {
  const [{ habitId }, search] = await Promise.all([params, searchParams])
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = await getHabitDetailData(supabase, user.id, habitId)
  if (!result) notFound()

  const rawNotice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  const metadataName = user.user_metadata?.display_name
  const fallbackName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : 'Your space'
  const userName = result.data.profileName && result.data.profileName !== 'Your space'
    ? result.data.profileName
    : fallbackName

  return (
    <AppShell userName={userName} userEmail={user.email ?? ''}>
      <HabitDetail habit={result.habit} data={result.data} notice={rawNotice} />
    </AppShell>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { WorkoutDetail } from '@/features/physical/components/workout-detail'
import { getWorkoutDetail } from '@/features/physical/physical-service'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = { title: 'Workout', description: 'Exercises and sets for one workout.' }

type PageProps = { params: Promise<{ workoutId: string }>; searchParams: Promise<{ notice?: string | string[] }> }

export default async function WorkoutPage({ params, searchParams }: PageProps) {
  const [{ workoutId }, search, session] = await Promise.all([params, searchParams, getPageSession()])
  if (!uuidSchema.safeParse(workoutId).success) notFound()
  const data = await getWorkoutDetail(session.supabase, session.userId, workoutId)
  if (!data) notFound()
  const notice = Array.isArray(search.notice) ? search.notice[0] : search.notice
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <WorkoutDetail data={data} timeZone={session.timeZone} notice={notice} />
    </AppShell>
  )
}

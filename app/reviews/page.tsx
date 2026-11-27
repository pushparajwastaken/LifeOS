import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { pillarSession } from '@/features/pillars/pillar-actions-kit'
import { WeeklyReview } from '@/features/reviews/components/weekly-review'
import { parseReviewWeek } from '@/features/reviews/review-domain'
import { getWeeklyReviewData } from '@/features/reviews/review-service'

export const metadata: Metadata = { title: 'Weekly review', description: 'Reflect on the week and choose next week’s priorities.' }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function ReviewsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([pillarSession(), searchParams])
  const week = parseReviewWeek(first(params.week), session.today)
  const data = await getWeeklyReviewData(session.supabase, session.userId, week, session.timeZone)
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <WeeklyReview data={data} week={week} today={session.today} notice={first(params.notice)} />
    </AppShell>
  )
}

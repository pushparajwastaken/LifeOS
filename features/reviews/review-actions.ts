'use server'

import { weekStartOf } from '@/features/pillars/pillar-domain'
import { field, finish, pillarSession } from '@/features/pillars/pillar-actions-kit'
import { weeklyReviewSchema } from './review-domain'

/** Creates or replaces the review for one Monday week; future weeks are refused. */
export async function saveWeeklyReviewAction(formData: FormData): Promise<void> {
  const { supabase, userId, today } = await pillarSession()
  const parsed = weeklyReviewSchema.safeParse({ week: field(formData, 'week'), wins: field(formData, 'wins'), failures: field(formData, 'failures'), blockers: field(formData, 'blockers'), next_priorities: field(formData, 'next_priorities') })
  const current = weekStartOf(today)
  if (!parsed.success || weekStartOf(parsed.data.week) !== parsed.data.week || parsed.data.week > current) finish('/reviews', 'weekly-review-invalid')
  const { week, ...fields } = parsed.data
  const path = week === current ? '/reviews' : `/reviews?week=${week}`
  const { error } = await supabase.from('weekly_reviews').upsert({ user_id: userId, week_start: week, ...fields }, { onConflict: 'user_id,week_start' })
  finish(path, error ? 'save-failed' : 'weekly-review-saved')
}

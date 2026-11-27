import 'server-only'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getLocalDateKey } from '@/features/habits/habit-domain'
import { zonedLocalToUtcIso } from '@/features/learning/learning-domain'
import { uuidSchema } from '@/features/quests/quest-domain'
import { getPageSession } from '@/lib/page-session'

/** String value of a form field ('' when missing or not a string). */
export function field(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Revalidates the module (and Home/analytics, which summarise it) and redirects with a notice. */
export function finish(path: string, notice: string, anchor = ''): never {
  const root = `/${path.split('/')[1] ?? ''}`
  revalidatePath(root, 'layout')
  revalidatePath('/')
  redirect(`${path}${path.includes('?') ? '&' : '?'}notice=${notice}${anchor}`)
}

export async function pillarSession() {
  const session = await getPageSession()
  return { ...session, today: getLocalDateKey(new Date(), session.timeZone) }
}

/** A uuid from the form, or a redirect to `fallback` with record-not-found. */
export function requireId(formData: FormData, name: string, fallback: string): string {
  const parsed = uuidSchema.safeParse(field(formData, name))
  if (!parsed.success) finish(fallback, 'record-not-found')
  return parsed.data
}

/** Local date + time in the profile timezone as an instant; null when it is in the future. */
export function pastInstant(date: string, time: string, timeZone: string): string | null {
  const iso = zonedLocalToUtcIso(date, time, timeZone)
  return Date.parse(iso) > Date.now() + 60_000 ? null : iso
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPageSession } from '@/lib/page-session'
import { profileInputSchema } from './settings-domain'

function text(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

/** Saves the display name and timezone of the signed-in user's own profile row. */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const parsed = profileInputSchema.safeParse({ displayName: text(formData, 'displayName'), timeZone: text(formData, 'timeZone') })
  if (!parsed.success) redirect('/settings?notice=profile-invalid#profile')
  const { supabase, userId } = await getPageSession()
  const { data, error } = await supabase.from('profiles')
    .update({ display_name: parsed.data.displayName, timezone: parsed.data.timeZone })
    .eq('id', userId).select('id').maybeSingle()
  // Every page reads the name and timezone, so refresh the whole app.
  revalidatePath('/', 'layout')
  redirect(`/settings?notice=${error || !data ? 'save-failed' : 'profile-saved'}#profile`)
}

import 'server-only'

import { redirect } from 'next/navigation'
import { normalizeTimeZone } from '@/features/habits/habit-domain'
import { createClient } from '@/lib/supabase/server'

/** Signed-in context for an app page: redirects to /login when there is no session. */
export async function getPageSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name,timezone')
    .eq('id', user.id)
    .maybeSingle()

  const metadataName = user.user_metadata?.display_name
  const profileName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  const fallbackName = typeof metadataName === 'string' && metadataName.trim() ? metadataName.trim() : 'Your space'

  return {
    supabase,
    userId: user.id,
    userName: profileName && profileName !== 'Your space' ? profileName : fallbackName,
    userEmail: user.email ?? '',
    timeZone: normalizeTimeZone(profile?.timezone),
  }
}

import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { createClient } from '@/lib/supabase/server'

export async function AuthenticatedAppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const metadataName = user.user_metadata?.display_name
  const userName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : 'Your space'

  return (
    <AppShell userName={userName} userEmail={user.email ?? ''}>
      {children}
    </AppShell>
  )
}

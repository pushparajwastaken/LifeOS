import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { CalendarSettings } from '@/features/calendar/calendar-settings'
import { getCalendarSettingsData } from '@/features/calendar/calendar-service'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your LifeOS account and connected integrations.',
}

type PageProps = {
  searchParams: Promise<{ authorization?: string | string[] }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const [data, params] = await Promise.all([
    getCalendarSettingsData(),
    searchParams,
  ])
  if (!data) redirect('/login')
  const authorizationNotice = Array.isArray(params.authorization)
    ? params.authorization[0]
    : params.authorization

  return (
    <AppShell userName={data.userName} userEmail={data.userEmail}>
      <CalendarSettings connection={data.connection} authorizationNotice={authorizationNotice} />
    </AppShell>
  )
}

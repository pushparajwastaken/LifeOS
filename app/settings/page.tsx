import type { Metadata } from 'next'
import { AppShell } from '@/components/layout/app-shell'
import { CalendarSettings } from '@/features/calendar/calendar-settings'
import { getCalendarSettingsData } from '@/features/calendar/calendar-service'
import { AccountSettings } from '@/features/settings/components/account-settings'
import styles from '@/features/quests/quests.module.css'
import { getPageSession } from '@/lib/page-session'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your profile, timezone, data export and connected integrations.',
}

type PageProps = {
  searchParams: Promise<{ authorization?: string | string[]; notice?: string | string[] }>
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function SettingsPage({ searchParams }: PageProps) {
  const [session, calendar, params] = await Promise.all([getPageSession(), getCalendarSettingsData(), searchParams])
  return (
    <AppShell userName={session.userName} userEmail={session.userEmail}>
      <div className={styles.page}>
        <AccountSettings displayName={session.profileDisplayName} timeZone={session.timeZone} email={session.userEmail} notice={first(params.notice)} />
        {calendar ? <CalendarSettings connection={calendar.connection} authorizationNotice={first(params.authorization)} embedded /> : null}
      </div>
    </AppShell>
  )
}

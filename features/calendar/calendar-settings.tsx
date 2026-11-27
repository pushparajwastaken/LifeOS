'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ExternalLink, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  disconnectGoogleCalendarAction,
  startGoogleCalendarAuthorizationAction,
  testGoogleCalendarConnectionAction,
} from '@/features/calendar/calendar-actions'
import type { CalendarConnectionView } from '@/features/calendar/calendar-types'
import styles from '@/features/calendar/calendar-settings.module.css'

type Props = {
  connection: CalendarConnectionView
  authorizationNotice?: string
  /** Inside the Settings page, which provides its own page header. */
  embedded?: boolean
}

function formatDate(value: string | null): string {
  if (!value) return 'Not synced yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not synced yet'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function noticeText(notice: string | undefined): string | null {
  switch (notice) {
    case 'connected':
      return 'Google authorization succeeded. The dedicated LifeOS calendar was created or verified.'
    case 'cancelled':
      return 'Google authorization was cancelled. No calendar was connected.'
    case 'failed':
      return 'Google authorization could not be completed. Please try again.'
    case 'expired':
      return 'Your LifeOS session expired. Sign in again, then reconnect Google Calendar.'
    case 'runtime_identity_unavailable':
      return 'This v0 Preview workspace cannot refresh its Vercel OIDC identity. Test Google consent on a Preview deployment of this Vercel project.'
    case 'connector_not_found':
      return 'Vercel Connect could not find the configured google/lifeos-calendar connector for this project.'
    case 'project_link_missing':
      return 'The google/lifeos-calendar connector is not linked to the Vercel project serving this deployment.'
    case 'environment_disabled':
      return 'The google/lifeos-calendar connector is not enabled for this deployment environment.'
    case 'user_authorization_required':
      return 'This LifeOS user has not authorized Google Calendar yet. Start the Google consent flow again.'
    case 'no_valid_token':
      return 'No valid Google authorization is available for this LifeOS user. Reconnect Google Calendar.'
    case 'connector_installation_required':
      return 'Vercel Connect requires an installation for this connector before authorization can continue.'
    case 'connect_error':
      return 'Vercel Connect rejected the request. Check the server diagnostic for its code and status.'
    default:
      return null
  }
}

export function CalendarSettings({ connection, authorizationNotice, embedded = false }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const authorizationFeedback = noticeText(authorizationNotice)
  const [feedback, setFeedback] = useState<string | null>(authorizationFeedback)
  const [feedbackIsError, setFeedbackIsError] = useState(
    Boolean(authorizationFeedback && authorizationNotice !== 'connected' && authorizationNotice !== 'cancelled'),
  )

  const beginAuthorization = async (reconnect = false) => {
    setBusy(true)
    setFeedback(null)
    setFeedbackIsError(false)
    try {
      const result = await startGoogleCalendarAuthorizationAction(reconnect)
      if (!result.ok) {
        setFeedbackIsError(true)
        setFeedback(result.message)
        setBusy(false)
        if (result.code === 'session_required' || result.code === 'session_unavailable') {
          router.push('/login?next=%2Fsettings')
        }
        return
      }

      if (window.self !== window.top) {
        const authorizationWindow = window.open(result.url, '_blank', 'noopener,noreferrer')
        setFeedback(authorizationWindow
          ? 'Finish Google authorization in the new tab, then return here.'
          : 'Allow pop-ups for this site, then retry Google authorization.')
        setFeedbackIsError(!authorizationWindow)
        setBusy(false)
      } else {
        window.location.href = result.url
      }
    } catch {
      setFeedbackIsError(true)
      setFeedback('LifeOS could not start the authorization request. Check the server diagnostic and retry.')
      setBusy(false)
    }
  }

  const testConnection = async () => {
    setBusy(true)
    setFeedback(null)
    try {
      const result = await testGoogleCalendarConnectionAction()
      setFeedbackIsError(!result.ok)
      setFeedback(result.message)
      router.refresh()
    } catch {
      setFeedbackIsError(true)
      setFeedback('The connection could not be tested. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    const confirmed = window.confirm(
      'Disconnect Google Calendar? LifeOS will revoke its access. Existing events in Google Calendar will remain there.',
    )
    if (!confirmed) return

    setBusy(true)
    setFeedback(null)
    try {
      await disconnectGoogleCalendarAction()
      setFeedbackIsError(false)
      setFeedback('Google Calendar has been disconnected. Existing calendar events were left unchanged.')
      router.refresh()
    } catch {
      setFeedbackIsError(true)
      setFeedback('Google Calendar could not be disconnected. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const connected = connection.status === 'connected'
  const needsReconnect = connection.status === 'reauthorize' || connection.status === 'repair'
  const statusLabel = connected
    ? 'Connected'
    : needsReconnect
      ? connection.status === 'repair' ? 'Calendar needs repair' : 'Reconnect required'
      : connection.status === 'unavailable'
        ? 'Temporarily unavailable'
        : 'Not connected'
  const lastSyncLabel = connection.lastSyncStatus === 'error'
    ? 'Sync needs attention'
    : connection.lastSyncStatus === 'pending'
      ? 'Pending first habit sync'
      : connection.lastSyncStatus === 'synced' && connection.lastSyncedAt
        ? `Synced ${formatDate(connection.lastSyncedAt)}`
        : 'No habit events synced yet'

  return (
    <div className={styles.page}>
      {embedded ? null : (
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>LIFEOS PREFERENCES</p>
            <h1>Settings</h1>
            <p className={styles.intro}>Manage your connected services and synchronization preferences.</p>
          </div>
        </header>
      )}

      {feedback && (
        <p className={feedbackIsError ? styles.feedbackError : styles.feedback} role={feedbackIsError ? 'alert' : 'status'}>
          {feedback}
        </p>
      )}

      <section className={styles.integrationsSection} aria-labelledby="integrations-title">
        <div className={styles.integrationHeading}>
          <h2 id="integrations-title">Integrations</h2>
          <p>Connect the services that support your LifeOS routines.</p>
        </div>
      <section className={styles.connectionCard} aria-labelledby="calendar-connection-title">
        <div className={styles.cardHeader}>
          <div className={styles.calendarIcon} aria-hidden="true"><CalendarDays /></div>
          <div className={styles.cardHeading}>
            <div className={styles.titleRow}>
              <h3 id="calendar-connection-title">Google Calendar</h3>
              <span className={`${styles.statusPill} ${connected ? styles.statusConnected : needsReconnect || connection.status === 'unavailable' ? styles.statusAttention : ''}`}>
                <span className={styles.statusDot} aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
            <p>{connection.statusMessage}</p>
          </div>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Calendar</dt>
            <dd>{connection.calendarName}</dd>
          </div>
          <div>
            <dt>Last synchronization status</dt>
            <dd>{lastSyncLabel}</dd>
          </div>
        </dl>

        <div className={styles.actions}>
          {connected ? (
            <>
              <Button type="button" onClick={testConnection} disabled={busy}>
                <ShieldCheck data-icon="inline-start" />
                {busy ? 'Checking…' : 'Test connection'}
              </Button>
              <Button type="button" variant="outline" onClick={() => beginAuthorization(true)} disabled={busy}>
                <RefreshCw data-icon="inline-start" />
                Reconnect
              </Button>
              <Button type="button" variant="destructive" onClick={disconnect} disabled={busy}>
                <Unplug data-icon="inline-start" />
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={() => beginAuthorization(needsReconnect || connection.status === 'unavailable')} disabled={busy}>
                <CalendarDays data-icon="inline-start" />
                {busy ? 'Opening Google…' : needsReconnect || connection.status === 'unavailable' ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
              </Button>
              {(connection.calendarUrl || needsReconnect) && (
                <Button type="button" variant="destructive" onClick={disconnect} disabled={busy}>
                  <Unplug data-icon="inline-start" />
                  Disconnect
                </Button>
              )}
            </>
          )}
          {connection.lastSyncError && (
            <p className={styles.feedbackError} role="alert">{connection.lastSyncError}</p>
          )}
          {connection.calendarUrl && (
            <a className={styles.calendarLink} href={connection.calendarUrl} target="_blank" rel="noreferrer">
              Open in Google Calendar
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>

        <p className={styles.note}>
          LifeOS requests access only to calendars created by this app. Habit completion, streaks, reflections, and analytics stay in LifeOS; connecting does not import or read your personal calendars.
        </p>
      </section>

      <section className={styles.syncCard} aria-labelledby="sync-status-title">
        <div className={styles.syncIcon} aria-hidden="true"><RefreshCw /></div>
        <div>
          <h2 id="sync-status-title">Habit event synchronization</h2>
          <p>Calendar access is verified separately before any habit events are created. Event synchronization has not started yet.</p>
        </div>
      </section>
      </section>
    </div>
  )
}

import 'server-only'

import {
  deleteTokenCacheEntry,
  getToken,
  revokeToken,
} from '@vercel/connect'
import { google } from 'googleapis'
import { normalizeTimeZone } from '@/features/habits/habit-domain'
import type { CalendarConnectionView, CalendarSettingsData } from '@/features/calendar/calendar-types'
import {
  getCalendarConnectFailure,
  logCalendarIntegrationFailure,
} from '@/features/calendar/connect-diagnostics'
import { createClient } from '@/lib/supabase/server'

export const GOOGLE_CALENDAR_CONNECTOR = 'google/lifeos-calendar'
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
export const LIFEOS_CALENDAR_NAME = 'LifeOS'

const LIFEOS_CALENDAR_DESCRIPTION = 'Created by LifeOS for scheduled habits.'

type CalendarConnectionRow = {
  calendar_id: string
  calendar_name: string
  time_zone: string
  last_synced_at: string | null
  last_sync_status: 'pending' | 'synced' | 'error'
  last_sync_error: string | null
}

type ProviderError = {
  code?: number | string
  response?: { status?: number }
}

function providerStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const providerError = error as ProviderError
  const value = providerError.response?.status ?? providerError.code
  const status = Number(value)
  return Number.isFinite(status) ? status : undefined
}

function authorizationRequired(error: unknown): boolean {
  const code = getCalendarConnectFailure(error)?.code
  return code === 'user_authorization_required'
    || code === 'no_valid_token'
    || providerStatus(error) === 401
}

function safeCalendarError(error: unknown): string {
  const connectFailure = getCalendarConnectFailure(error)
  if (connectFailure && connectFailure.code !== 'connect_error') return connectFailure.message
  if (authorizationRequired(error)) {
    return 'Google authorization is missing or expired. Reconnect to restore calendar access.'
  }
  if (connectFailure) return connectFailure.message
  if (providerStatus(error) === 403) {
    return 'Google denied access to the LifeOS calendar. Reconnect and confirm the configured calendar permission.'
  }
  if (providerStatus(error) === 404) {
    return 'The LifeOS calendar could not be found. Reconnect to create it again.'
  }
  return 'Google Calendar could not be verified. Try again in a moment.'
}

function connectParams(userId: string) {
  return {
    subject: { type: 'user' as const, id: userId },
    scopes: [GOOGLE_CALENDAR_SCOPE],
  }
}

async function getCalendarClient(userId: string, forceRefresh = false) {
  let token: string
  try {
    token = await getToken(
      GOOGLE_CALENDAR_CONNECTOR,
      connectParams(userId),
      forceRefresh ? { forceRefresh: true } : undefined,
    )
  } catch (error) {
    logCalendarIntegrationFailure('getToken', GOOGLE_CALENDAR_CONNECTOR, error, {
      subjectType: 'user',
      requestedScopes: [GOOGLE_CALENDAR_SCOPE],
    })
    throw error
  }
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })
  return google.calendar({ version: 'v3', auth })
}

async function getAuthenticatedContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('LifeOS session required.')
  return { supabase, userId: user.id, user }
}

async function readConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from('habit_calendar_connections')
    .select('calendar_id,calendar_name,time_zone,last_synced_at,last_sync_status,last_sync_error')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error('Unable to load calendar connection details.')
  return data as CalendarConnectionRow | null
}

function buildCalendarUrl(calendarId: string | null): string | null {
  if (!calendarId) return null
  return `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId)}`
}

async function loadConnectionView(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CalendarConnectionView> {
  const row = await readConnection(supabase, userId)
  if (!row) {
    try {
      await getCalendarClient(userId, true)
      return {
        status: 'repair',
        statusMessage: 'Google authorization is active, but the LifeOS calendar record is missing. Reconnect to finish setup.',
        calendarName: LIFEOS_CALENDAR_NAME,
        calendarUrl: null,
        lastSyncStatus: null,
        lastSyncedAt: null,
        lastSyncError: null,
      }
    } catch (error) {
      if (authorizationRequired(error)) {
        return {
          status: 'disconnected',
          statusMessage: 'Connect a Google account to create and verify your dedicated LifeOS calendar.',
          calendarName: LIFEOS_CALENDAR_NAME,
          calendarUrl: null,
          lastSyncStatus: null,
          lastSyncedAt: null,
          lastSyncError: null,
        }
      }
      return {
        status: 'unavailable',
        statusMessage: safeCalendarError(error),
        calendarName: LIFEOS_CALENDAR_NAME,
        calendarUrl: null,
        lastSyncStatus: null,
        lastSyncedAt: null,
        lastSyncError: null,
      }
    }
  }

  try {
    const calendar = await getCalendarClient(userId, true)
    const { data } = await calendar.calendars.get({ calendarId: row.calendar_id })
    if (!data.id) {
      return {
        status: 'repair',
        statusMessage: 'Google did not return the LifeOS calendar. Reconnect to verify or recreate it.',
        calendarName: row.calendar_name || LIFEOS_CALENDAR_NAME,
        calendarUrl: buildCalendarUrl(row.calendar_id),
        lastSyncStatus: row.last_sync_status,
        lastSyncedAt: row.last_synced_at,
        lastSyncError: row.last_sync_error,
      }
    }
    return {
      status: 'connected',
      statusMessage: 'Google authorization is active and the dedicated LifeOS calendar is reachable.',
      calendarName: data.summary || row.calendar_name || LIFEOS_CALENDAR_NAME,
      calendarUrl: buildCalendarUrl(row.calendar_id),
      lastSyncStatus: row.last_sync_status,
      lastSyncedAt: row.last_synced_at,
      lastSyncError: row.last_sync_error,
    }
  } catch (error) {
    if (!getCalendarConnectFailure(error)) {
      logCalendarIntegrationFailure('verifyCalendar', GOOGLE_CALENDAR_CONNECTOR, error)
    }
    const status = providerStatus(error)
    if (authorizationRequired(error)) {
      deleteTokenCacheEntry(GOOGLE_CALENDAR_CONNECTOR, connectParams(userId))
      return {
        status: 'reauthorize',
        statusMessage: safeCalendarError(error),
        calendarName: row.calendar_name || LIFEOS_CALENDAR_NAME,
        calendarUrl: buildCalendarUrl(row.calendar_id),
        lastSyncStatus: row.last_sync_status,
        lastSyncedAt: row.last_synced_at,
        lastSyncError: row.last_sync_error,
      }
    }
    if (status === 404) {
      return {
        status: 'repair',
        statusMessage: safeCalendarError(error),
        calendarName: row.calendar_name || LIFEOS_CALENDAR_NAME,
        calendarUrl: buildCalendarUrl(row.calendar_id),
        lastSyncStatus: row.last_sync_status,
        lastSyncedAt: row.last_synced_at,
        lastSyncError: row.last_sync_error,
      }
    }
    return {
      status: 'unavailable',
      statusMessage: safeCalendarError(error),
      calendarName: row.calendar_name || LIFEOS_CALENDAR_NAME,
      calendarUrl: buildCalendarUrl(row.calendar_id),
      lastSyncStatus: row.last_sync_status,
      lastSyncedAt: row.last_synced_at,
      lastSyncError: row.last_sync_error,
    }
  }
}

export async function getCalendarSettingsData(): Promise<CalendarSettingsData | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const metadataName = user.user_metadata?.display_name
  const userName = typeof metadataName === 'string' && metadataName.trim()
    ? metadataName.trim()
    : 'Your space'
  return {
    userName,
    userEmail: user.email ?? '',
    connection: await loadConnectionView(supabase, user.id),
  }
}

async function getUserTimeZone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error('Unable to read the LifeOS timezone.')
  return normalizeTimeZone(data?.timezone)
}

async function upsertCalendarConnection(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  calendarId: string,
  calendarName: string,
  timeZone: string,
): Promise<void> {
  const { error } = await supabase
    .from('habit_calendar_connections')
    .upsert({
      user_id: userId,
      calendar_id: calendarId,
      calendar_name: calendarName,
      time_zone: timeZone,
      last_sync_status: 'pending',
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  if (error) throw new Error('Unable to save the LifeOS calendar connection.')
}

async function ensureCalendarListEntry(
  calendar: Awaited<ReturnType<typeof getCalendarClient>>,
  calendarId: string,
): Promise<void> {
  try {
    await calendar.calendarList.insert({ requestBody: { id: calendarId } })
  } catch (error) {
    if (providerStatus(error) !== 409) throw error
  }
}

export async function completeCurrentGoogleCalendarAuthorization(): Promise<void> {
  const { supabase, userId } = await getAuthenticatedContext()
  const timeZone = await getUserTimeZone(supabase, userId)
  const calendar = await getCalendarClient(userId)
  const existing = await readConnection(supabase, userId)
  let calendarId = existing?.calendar_id ?? null
  let calendarName = existing?.calendar_name || LIFEOS_CALENDAR_NAME
  let calendarTimeZone = existing?.time_zone || timeZone

  if (calendarId) {
    try {
      const { data } = await calendar.calendars.get({ calendarId })
      calendarName = data.summary || calendarName
      calendarTimeZone = data.timeZone || calendarTimeZone
    } catch (error) {
      if (providerStatus(error) !== 404) throw error
      calendarId = null
    }
  }

  if (!calendarId) {
    try {
      const { data } = await calendar.calendarList.list({ maxResults: 250, showHidden: true })
      const existingLifeOSCalendar = data.items?.find((item) =>
        item.summary === LIFEOS_CALENDAR_NAME
        && item.description === LIFEOS_CALENDAR_DESCRIPTION
        && Boolean(item.id),
      )
      if (existingLifeOSCalendar?.id) {
        calendarId = existingLifeOSCalendar.id
        calendarName = existingLifeOSCalendar.summary || LIFEOS_CALENDAR_NAME
        calendarTimeZone = existingLifeOSCalendar.timeZone || timeZone
      }
    } catch (error) {
      if (providerStatus(error) !== 403) throw error
    }
  }

  if (!calendarId) {
    const { data } = await calendar.calendars.insert({
      requestBody: {
        summary: LIFEOS_CALENDAR_NAME,
        description: LIFEOS_CALENDAR_DESCRIPTION,
        timeZone,
      },
    })
    if (!data.id) throw new Error('Google did not return a LifeOS calendar ID.')
    calendarId = data.id
    calendarName = data.summary || LIFEOS_CALENDAR_NAME
    calendarTimeZone = data.timeZone || timeZone
    await upsertCalendarConnection(supabase, userId, calendarId, calendarName, calendarTimeZone)
  }

  await ensureCalendarListEntry(calendar, calendarId)
  const { data: verifiedCalendar } = await calendar.calendars.get({ calendarId })
  if (verifiedCalendar.id !== calendarId) {
    throw new Error('The LifeOS calendar verification did not match the saved calendar.')
  }

  await upsertCalendarConnection(
    supabase,
    userId,
    calendarId,
    verifiedCalendar.summary || calendarName,
    verifiedCalendar.timeZone || calendarTimeZone,
  )
}

export async function testCurrentGoogleCalendarConnection(): Promise<{
  ok: boolean
  message: string
  reconnectRequired: boolean
}> {
  const { supabase, userId } = await getAuthenticatedContext()
  const connection = await readConnection(supabase, userId)
  if (!connection) {
    return {
      ok: false,
      message: 'Connect Google Calendar before testing access.',
      reconnectRequired: false,
    }
  }

  try {
    const calendar = await getCalendarClient(userId, true)
    const { data } = await calendar.calendars.get({ calendarId: connection.calendar_id })
    if (data.id !== connection.calendar_id) {
      return {
        ok: false,
        message: 'The LifeOS calendar did not match the saved connection. Reconnect to repair it.',
        reconnectRequired: true,
      }
    }
    return {
      ok: true,
      message: 'Access verified. Your dedicated LifeOS calendar is reachable.',
      reconnectRequired: false,
    }
  } catch (error) {
    if (!getCalendarConnectFailure(error)) {
      logCalendarIntegrationFailure('testCalendarConnection', GOOGLE_CALENDAR_CONNECTOR, error)
    }
    if (authorizationRequired(error)) {
      deleteTokenCacheEntry(GOOGLE_CALENDAR_CONNECTOR, connectParams(userId))
    }
    return {
      ok: false,
      message: safeCalendarError(error),
      reconnectRequired: authorizationRequired(error) || providerStatus(error) === 404,
    }
  }
}

export async function disconnectCurrentGoogleCalendar(): Promise<void> {
  const { supabase, userId } = await getAuthenticatedContext()
  try {
    await revokeToken(GOOGLE_CALENDAR_CONNECTOR, connectParams(userId))
  } catch (error) {
    logCalendarIntegrationFailure('revokeToken', GOOGLE_CALENDAR_CONNECTOR, error)
    if (!authorizationRequired(error)) throw new Error('Unable to revoke Google Calendar access.')
  }
  const { error } = await supabase
    .from('habit_calendar_connections')
    .delete()
    .eq('user_id', userId)
  if (error) throw new Error('Google access was revoked, but LifeOS could not clear the connection record.')
}

'use server'

import { startAuthorization } from '@vercel/connect'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import {
  disconnectCurrentGoogleCalendar,
  GOOGLE_CALENDAR_CONNECTOR,
  GOOGLE_CALENDAR_SCOPE,
  testCurrentGoogleCalendarConnection,
} from '@/features/calendar/calendar-service'
import {
  getCalendarConnectFailure,
  logCalendarIntegrationFailure,
  type CalendarConnectFailureCode,
} from '@/features/calendar/connect-diagnostics'
import { createClient } from '@/lib/supabase/server'

async function getOrigin(): Promise<string> {
  if (process.env.NODE_ENV !== 'production' && process.env.V0_RUNTIME_URL) {
    return process.env.V0_RUNTIME_URL
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  if (!host) throw new Error('Unable to determine the LifeOS callback origin.')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? 'https'
  if (protocol !== 'http' && protocol !== 'https') {
    throw new Error('Unable to determine the LifeOS callback origin.')
  }
  return `${protocol}://${host}`
}

export type GoogleCalendarAuthorizationStart =
  | { ok: true; url: string }
  | {
      ok: false
      code: CalendarConnectFailureCode | 'session_required' | 'session_unavailable' | 'callback_origin_unavailable'
      message: string
    }

export async function startGoogleCalendarAuthorizationAction(
  reconnect = false,
): Promise<GoogleCalendarAuthorizationStart> {
  const supabase = await createClient()
  const { data: { user }, error: sessionError } = await supabase.auth.getUser()
  if (sessionError) {
    logCalendarIntegrationFailure('supabaseSession', GOOGLE_CALENDAR_CONNECTOR, sessionError)
    return {
      ok: false,
      code: 'session_unavailable',
      message: 'LifeOS could not verify your session. Sign in again, then retry Google Calendar.',
    }
  }
  if (!user) {
    return {
      ok: false,
      code: 'session_required',
      message: 'Sign in to LifeOS before connecting Google Calendar.',
    }
  }

  let callbackUrl: string
  try {
    callbackUrl = new URL('/settings/calendar/return', await getOrigin()).toString()
  } catch (error) {
    logCalendarIntegrationFailure('resolveCallbackOrigin', GOOGLE_CALENDAR_CONNECTOR, error)
    return {
      ok: false,
      code: 'callback_origin_unavailable',
      message: 'LifeOS could not determine a safe callback URL for this deployment.',
    }
  }

  try {
    const { url } = await startAuthorization(
      GOOGLE_CALENDAR_CONNECTOR,
      {
        subject: { type: 'user', id: user.id },
        scopes: [GOOGLE_CALENDAR_SCOPE],
      },
      {
        callbackUrl,
        ...(reconnect ? { prompt: 'consent' } : {}),
      },
    )
    return { ok: true, url }
  } catch (error) {
    logCalendarIntegrationFailure('startAuthorization', GOOGLE_CALENDAR_CONNECTOR, error, {
      callbackHost: new URL(callbackUrl).host,
      subjectType: 'user',
      requestedScopes: [GOOGLE_CALENDAR_SCOPE],
    })
    const failure = getCalendarConnectFailure(error)
    return {
      ok: false,
      code: failure?.code ?? 'connect_error',
      message: failure?.message ?? 'Vercel Connect could not start Google authorization. Check the server diagnostic and retry on the linked Vercel deployment.',
    }
  }
}

export async function testGoogleCalendarConnectionAction() {
  const result = await testCurrentGoogleCalendarConnection()
  revalidatePath('/settings')
  return result
}

export async function disconnectGoogleCalendarAction() {
  await disconnectCurrentGoogleCalendar()
  revalidatePath('/settings')
  return { ok: true as const }
}

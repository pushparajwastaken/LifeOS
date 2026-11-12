import { NextRequest, NextResponse } from 'next/server'
import {
  getCalendarConnectFailure,
  logCalendarIntegrationFailure,
} from '@/features/calendar/connect-diagnostics'
import {
  completeCurrentGoogleCalendarAuthorization,
  GOOGLE_CALENDAR_CONNECTOR,
  GOOGLE_CALENDAR_SCOPE,
} from '@/features/calendar/calendar-service'
import { createClient } from '@/lib/supabase/server'

function settingsRedirect(request: NextRequest, status: string) {
  const destination = new URL('/settings', request.url)
  destination.searchParams.set('authorization', status)
  return NextResponse.redirect(destination)
}

export async function GET(request: NextRequest) {
  const providerError = request.nextUrl.searchParams.get('error')
  if (providerError) {
    return settingsRedirect(request, providerError === 'access_denied' ? 'cancelled' : 'failed')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const destination = new URL('/login', request.url)
    destination.searchParams.set('next', '/settings')
    return NextResponse.redirect(destination)
  }

  try {
    await completeCurrentGoogleCalendarAuthorization()
    return settingsRedirect(request, 'connected')
  } catch (error) {
    logCalendarIntegrationFailure('authorizationCallback', GOOGLE_CALENDAR_CONNECTOR, error, {
      subjectType: 'user',
      requestedScopes: [GOOGLE_CALENDAR_SCOPE],
    })
    const failure = getCalendarConnectFailure(error)
    return settingsRedirect(request, failure?.code ?? 'failed')
  }
}

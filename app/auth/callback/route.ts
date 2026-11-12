import { NextRequest, NextResponse } from 'next/server'
import { RECOVERY_COOKIE } from '@/lib/supabase/recovery'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const isRecovery = request.nextUrl.searchParams.get('flow') === 'recovery'
    && request.nextUrl.searchParams.get('next') === '/update-password'
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL(isRecovery ? '/update-password?error=invalid-link' : '/auth/error', request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL(isRecovery ? '/update-password?error=invalid-link' : '/auth/error', request.url))
  }

  const response = NextResponse.redirect(new URL(isRecovery ? '/update-password' : '/', request.url))
  if (isRecovery) {
    response.cookies.set(RECOVERY_COOKIE, 'verified', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/update-password',
      maxAge: 15 * 60,
    })
  }
  return response
}

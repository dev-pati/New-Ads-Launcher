import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const hasSession = Boolean(request.cookies.get('adlauncher_session')?.value)
  if (
    !hasSession &&
    request.nextUrl.pathname !== '/' &&
    !request.nextUrl.pathname.startsWith('/privacy-policy') &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/api/auth') &&
    !request.nextUrl.pathname.startsWith('/invite') &&
    !request.nextUrl.pathname.startsWith('/api/mcp') &&
    !request.nextUrl.pathname.startsWith('/api/cron') &&
    !request.nextUrl.pathname.startsWith('/.well-known') &&
    !request.nextUrl.pathname.startsWith('/mcp/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

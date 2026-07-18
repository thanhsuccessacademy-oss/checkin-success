import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Skip asset routing
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get('session')?.value
  const session = sessionToken ? await decrypt(sessionToken) : null

  if (!session) {
    // Redirect to login if accessing protected routes without session
    if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/hr')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  } else {
    // Session exists
    if (path === '/login' || path === '/') {
      const url = request.nextUrl.clone()
      if (session.role === 'admin') {
        url.pathname = '/admin'
      } else if (session.role === 'hanhchinh') {
        url.pathname = '/hr'
      } else {
        url.pathname = '/dashboard'
      }
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/dashboard')) {
      if (session.role === 'admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/admin'
        return NextResponse.redirect(url)
      }
      if (session.role === 'hanhchinh') {
        const url = request.nextUrl.clone()
        url.pathname = '/hr'
        return NextResponse.redirect(url)
      }
    }

    if (path.startsWith('/admin') && session.role !== 'admin' && session.role !== 'superadmin') {
      // Non-admin trying to access admin panel
      const url = request.nextUrl.clone()
      url.pathname = session.role === 'hanhchinh' ? '/hr' : '/dashboard'
      return NextResponse.redirect(url)
    }

    if (path.startsWith('/hr') && session.role !== 'admin' && session.role !== 'hanhchinh' && session.role !== 'superadmin') {
      // Regular employee trying to access HR panel
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

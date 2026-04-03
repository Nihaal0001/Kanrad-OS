import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — IMPORTANT: do not remove this call
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public API routes that don't require authentication (add new ones here explicitly)
  const PUBLIC_API_ROUTES: string[] = ["/api/kiosk", "/api/cron", "/api/auth/login", "/api/auth/logout"]
  const isPublicApi = PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))

  // Not logged in → redirect to login (except for auth routes, kiosk, portal, scan, print, and explicitly public API routes)
  if (!user && !pathname.startsWith("/auth") && !pathname.startsWith("/kiosk") && !pathname.startsWith("/portal") && !pathname.startsWith("/scan") && !pathname.startsWith("/print") && !isPublicApi) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  // Already logged in → redirect away from auth pages
  if (user && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and images
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}

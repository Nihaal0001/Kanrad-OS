import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  const cookieStore = await cookies()
  // Clear all Supabase session cookies
  const allCookies = cookieStore.getAll()
  for (const cookie of allCookies) {
    if (cookie.name.startsWith("sb-")) {
      cookieStore.delete(cookie.name)
    }
  }
  return NextResponse.json({ ok: true })
}

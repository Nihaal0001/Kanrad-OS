import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Handles email confirmation links (Supabase sends users here)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/"
  // Only allow relative paths (not protocol-relative //evil.com or absolute URLs)
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/"

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

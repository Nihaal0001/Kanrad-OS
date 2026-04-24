import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const SUPABASE_URL = "https://bdskmkfubdmmzvntzzgu.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc2tta2Z1YmRtbXp2bnR6emd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjA0MTgsImV4cCI6MjA5MDMzNjQxOH0.ske_ZN9DDjA5XcnDXwwLaMNI3Pn0iXt2-eyPUB9hwzc"
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc2tta2Z1YmRtbXp2bnR6emd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDc2MDQxOCwiZXhwIjoyMDkwMzM2NDE4fQ.m2_cTyjLj0QmoD6ssJL7XuQubfajch2y1fGm19N-lS8"

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const cookieStore = await cookies()

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        )
      },
    },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // Check role — only admins can access the dashboard
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .or(`auth_id.eq.${data.user.id},email.eq.${data.user.email}`)
    .maybeSingle()

  if (profile?.role !== "admin") {
    await supabase.auth.signOut()
    return NextResponse.json(
      { error: "Access denied. Only administrators can log in here." },
      { status: 403 }
    )
  }

  return NextResponse.json({ ok: true })
}

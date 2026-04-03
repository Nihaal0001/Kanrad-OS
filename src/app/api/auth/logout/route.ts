import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    "https://bdskmkfubdmmzvntzzgu.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc2tta2Z1YmRtbXp2bnR6emd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjA0MTgsImV4cCI6MjA5MDMzNjQxOH0.ske_ZN9DDjA5XcnDXwwLaMNI3Pn0iXt2-eyPUB9hwzc",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}

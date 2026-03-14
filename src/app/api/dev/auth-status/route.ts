import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// DEV ONLY — remove before production
export async function GET() {
  const admin = createAdminClient()
  const { data: { users }, error } = await admin.auth.admin.listUsers()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      confirmed: !!u.email_confirmed_at,
      confirmed_at: u.email_confirmed_at,
      last_sign_in: u.last_sign_in_at,
    }))
  )
}

// Force confirm + set password
export async function POST(request: Request) {
  const { email, password } = await request.json()
  const admin = createAdminClient()

  const { data: { users } } = await admin.auth.admin.listUsers()
  const user = users.find((u) => u.email === email)

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    password,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, user: data.user.email })
}

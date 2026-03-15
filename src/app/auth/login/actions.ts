"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"

export async function login(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase()
  const password = formData.get("password") as string

  // Finding #4 — rate limit login to 5 attempts per minute per email
  if (!rateLimit(`login:${email}`, 5, 60_000)) {
    redirect(`/auth/login?error=${encodeURIComponent("Too many login attempts. Please wait a minute and try again.")}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Auto-confirm unconfirmed users and retry (first-time sign-in flow)
    if (error.message.includes("Email not confirmed") || error.code === "email_not_confirmed") {
      const admin = createAdminClient()
      const { data: { users } } = await admin.auth.admin.listUsers()
      const authUser = users.find((u) => u.email === email)
      if (authUser) {
        await admin.auth.admin.updateUserById(authUser.id, { email_confirm: true })
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password })
        if (!retryError) redirect("/")
      }
    }

    redirect(`/auth/login?error=${encodeURIComponent("Invalid email or password.")}`)
  }

  redirect("/")
}

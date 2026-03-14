"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function login(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Auto-confirm the user if their email hasn't been confirmed yet
    // (happens when users are created via Supabase dashboard without disabling email confirmation)
    const admin = createAdminClient()
    const { data: { users } } = await admin.auth.admin.listUsers()
    const match = users.find((u) => u.email === email)

    if (match && !match.email_confirmed_at) {
      await admin.auth.admin.updateUserById(match.id, { email_confirm: true })
      // Retry sign in
      const { error: retryError } = await supabase.auth.signInWithPassword({ email, password })
      if (retryError) {
        redirect(`/auth/login?error=${encodeURIComponent(retryError.message)}`)
      }
      redirect("/")
    }

    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/")
}

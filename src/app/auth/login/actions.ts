"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

export async function login(formData: FormData) {
  const email = (formData.get("email") as string).trim().toLowerCase()
  const password = formData.get("password") as string

  // Rate limit: 5 attempts per minute per email
  if (!rateLimit(`login:${email}`, 5, 60_000)) {
    redirect(`/auth/login?error=${encodeURIComponent("Too many login attempts. Please wait a minute and try again.")}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent("Invalid email or password.")}`)
  }

  redirect("/")
}

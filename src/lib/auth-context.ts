import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

/**
 * Request-scoped auth/profile lookup shared by the dashboard layout and pages.
 * React's cache prevents repeated Supabase round trips during one navigation.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return { user: null, profile: null }

  const supabase = await createClient()
  const fields = "id, full_name, role, avatar_url, department"
  const { data: profileByAuthId } = await supabase
    .from("profiles")
    .select(fields)
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profileByAuthId || !user.email) {
    return { user, profile: profileByAuthId }
  }

  // One-time fallback for older profiles that predate auth_id linking.
  const { data: profileByEmail } = await supabase
    .from("profiles")
    .select(fields)
    .eq("email", user.email)
    .maybeSingle()

  if (profileByEmail) {
    await supabase
      .from("profiles")
      .update({ auth_id: user.id })
      .eq("id", profileByEmail.id)
  }

  return { user, profile: profileByEmail }
})

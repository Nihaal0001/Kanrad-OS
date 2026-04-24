import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUnreadCount } from "@/actions/notifications"
import { getRolePermissions } from "@/actions/users"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const [{ data: profileByAuthId }, unreadCount] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("auth_id", user.id)
      .maybeSingle(),
    getUnreadCount(),
  ])

  // Fallback: if auth_id not yet linked, find by email and link it automatically
  let profile = profileByAuthId
  if (!profile && user.email) {
    const { data: profileByEmail } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("email", user.email)
      .maybeSingle()

    if (profileByEmail) {
      profile = profileByEmail
      // Link auth_id so future lookups work instantly
      await supabase
        .from("profiles")
        .update({ auth_id: user.id })
        .eq("id", profileByEmail.id)
    }
  }

  const role = profile?.role ?? "worker"
  const allowedPermissions = await getRolePermissions(role)

  return (
    <DashboardShell
      unreadCount={unreadCount}
      userProfile={profile ?? { id: user.id, full_name: user.email ?? "User", role: "worker", avatar_url: null }}
      allowedPermissions={allowedPermissions}
    >
      {children}
    </DashboardShell>
  )
}

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

  const [{ data: profile }, unreadCount] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url")
      .eq("auth_id", user.id)
      .maybeSingle(),
    getUnreadCount(),
  ])

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

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getUnreadCount } from "@/actions/notifications"
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
      .single(),
    getUnreadCount(),
  ])

  return (
    <DashboardShell
      unreadCount={unreadCount}
      userProfile={profile ?? { id: "", full_name: user.email ?? "User", role: "admin", avatar_url: null }}
    >
      {children}
    </DashboardShell>
  )
}

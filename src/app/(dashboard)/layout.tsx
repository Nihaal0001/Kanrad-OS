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

  // If user doesn't have dashboard permission and is on the home page,
  // redirect to their first accessible page
  const { headers } = await import("next/headers")
  const headersList = await headers()
  const pathname = headersList.get("x-invoke-path") ?? ""
  const isHomePage = pathname === "" || pathname === "/"

  if (isHomePage && !allowedPermissions.includes("dashboard")) {
    const PERMISSION_FIRST_PAGE: Record<string, string> = {
      production: "/production",
      inventory: "/inventory",
      orders: "/orders",
      hr: "/hr/attendance",
      finance: "/finance",
      quality: "/quality",
      tasks: "/tasks",
      notifications: "/notifications",
      settings: "/settings",
      users: "/users",
    }
    const firstPage = allowedPermissions
      .map((p) => PERMISSION_FIRST_PAGE[p])
      .find(Boolean)
    if (firstPage) redirect(firstPage)
  }

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

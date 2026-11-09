import { redirect } from "next/navigation"
import { getUnreadCount } from "@/actions/notifications"
import { getRolePermissions } from "@/actions/users"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { getCurrentProfile } from "@/lib/auth-context"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authPromise = getCurrentProfile()
  const unreadCountPromise = getUnreadCount()
  const { user, profile } = await authPromise

  if (!user) {
    redirect("/auth/login")
  }

  const role = profile?.role ?? "worker"
  // Admins get full access via role; non-admins use their department field directly
  let allowedPermissions: string[]
  if (role === "admin") {
    allowedPermissions = await getRolePermissions(role)
  } else {
    const dept = profile?.department ?? ""
    allowedPermissions = dept ? dept.split(",").map((d: string) => d.trim()).filter(Boolean) : await getRolePermissions(role)
  }

  const unreadCount = await unreadCountPromise

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

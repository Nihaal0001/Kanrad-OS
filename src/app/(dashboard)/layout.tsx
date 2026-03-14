import { getUnreadCount } from "@/actions/notifications"
import { DashboardShell } from "@/components/layout/dashboard-shell"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const unreadCount = await getUnreadCount()

  return (
    <DashboardShell unreadCount={unreadCount}>
      {children}
    </DashboardShell>
  )
}

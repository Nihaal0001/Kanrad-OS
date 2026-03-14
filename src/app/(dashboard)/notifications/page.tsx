import { Bell, CheckCheck } from "lucide-react"

import { getNotifications, markAllAsRead } from "@/actions/notifications"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { NotificationsList } from "@/components/notifications/notifications-list"

export default async function NotificationsPage() {
  const notifications = await getNotifications()
  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread notification${unread !== 1 ? "s" : ""}`
            : "You're all caught up"
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Confirm orders, complete production stages, or submit QC checks to generate notifications."
        />
      ) : (
        <NotificationsList notifications={notifications} />
      )}
    </>
  )
}

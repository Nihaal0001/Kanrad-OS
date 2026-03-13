import { Bell } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts and updates from across the system"
      />
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="You're all caught up!"
      />
    </>
  )
}

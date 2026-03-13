import { CalendarDays } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function LeavesPage() {
  return (
    <>
      <PageHeader
        title="Leaves"
        description="Leave requests and approvals"
      />
      <EmptyState
        icon={CalendarDays}
        title="No leave requests"
        description="Leave requests will appear here"
      />
    </>
  )
}

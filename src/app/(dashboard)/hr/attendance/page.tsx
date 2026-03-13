import { Clock } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function AttendancePage() {
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily attendance and overtime tracking"
      />
      <EmptyState
        icon={Clock}
        title="No attendance records"
        description="Mark today's attendance to get started"
      />
    </>
  )
}

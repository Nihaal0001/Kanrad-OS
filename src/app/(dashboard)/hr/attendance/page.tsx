import { Clock } from "lucide-react"

import { getAttendance, getWorkers } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { AttendanceForm } from "@/components/hr/attendance-form"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700",
  absent: "bg-red-100 text-red-700",
  half_day: "bg-amber-100 text-amber-700",
  leave: "bg-blue-100 text-blue-700",
}

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "On Leave",
}

export default async function AttendancePage() {
  const [records, workers] = await Promise.all([getAttendance(), getWorkers()])

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily attendance and overtime tracking"
      >
        <AttendanceForm workers={workers} />
      </PageHeader>

      {records.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No attendance records"
          description="Mark today's attendance to get started"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Worker</span>
            <span>Date</span>
            <span>Status</span>
            <span>Check In</span>
            <span>Check Out</span>
            <span>OT Hours</span>
          </div>

          {records.map((r) => (
            <Card key={r.id}>
              <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 p-4">
                <div>
                  <p className="text-sm font-medium">{r.worker?.full_name ?? "—"}</p>
                  {r.worker?.department && (
                    <p className="text-xs text-muted-foreground">{r.worker.department}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{r.date}</p>
                <Badge className={cn("w-fit text-xs font-medium", STATUS_STYLES[r.status])}>
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
                <p className="text-sm text-muted-foreground">{r.check_in ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{r.check_out ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {r.overtime_hours > 0 ? `${r.overtime_hours}h` : "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

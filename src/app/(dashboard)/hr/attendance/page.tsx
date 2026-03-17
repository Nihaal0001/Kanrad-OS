import { getAttendanceForDate, getWorkers } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { AttendanceForm } from "@/components/hr/attendance-form"
import { AttendanceDateNav } from "@/components/hr/date-filter"
import { AttendanceStatusSection } from "@/components/hr/attendance-status-section"
import { DayChangeRefresh } from "@/components/hr/day-change-refresh"
import { cn } from "@/lib/utils"

interface Props {
  searchParams: Promise<{ date?: string }>
}

const SUMMARY_PILLS = [
  { key: "present", label: "Present", cls: "border border-emerald-500 text-emerald-600" },
  { key: "leave", label: "On Leave", cls: "border border-blue-500 text-blue-600" },
  { key: "half_day", label: "Half Day", cls: "border border-amber-500 text-amber-600" },
  { key: "absent", label: "Absent", cls: "border border-red-500 text-red-600" },
  {
    key: "not_marked",
    label: "Not Marked",
    cls: "border border-muted-foreground text-muted-foreground",
  },
] as const

export default async function AttendancePage({ searchParams }: Props) {
  const { date } = await searchParams
  const today = new Date().toISOString().split("T")[0]
  const effectiveDate = date ?? today

  const [rows, workers] = await Promise.all([
    getAttendanceForDate(effectiveDate),
    getWorkers(),
  ])

  const counts = {
    present: rows.filter((r) => r.attendance?.status === "present").length,
    leave: rows.filter((r) => r.attendance?.status === "leave").length,
    half_day: rows.filter((r) => r.attendance?.status === "half_day").length,
    absent: rows.filter((r) => r.attendance?.status === "absent").length,
    not_marked: rows.filter((r) => r.attendance === null).length,
  }

  const grouped = {
    present: rows.filter((r) => r.attendance?.status === "present"),
    leave: rows.filter((r) => r.attendance?.status === "leave"),
    half_day: rows.filter((r) => r.attendance?.status === "half_day"),
    absent: rows.filter((r) => r.attendance?.status === "absent"),
    not_marked: rows.filter((r) => r.attendance === null),
  }

  return (
    <>
      <PageHeader title="Attendance" description="Daily attendance and overtime tracking">
        <AttendanceDateNav date={effectiveDate} />
        <AttendanceForm workers={workers} defaultDate={effectiveDate} />
      </PageHeader>

      {/* Summary pills */}
      <div className="mb-5 flex flex-wrap gap-2">
        {SUMMARY_PILLS.map((pill) => (
          <div
            key={pill.key}
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-transparent px-3 py-1 text-sm font-medium",
              pill.cls
            )}
          >
            <span className="font-bold">{counts[pill.key]}</span>
            <span>{pill.label}</span>
          </div>
        ))}
      </div>

      {/* Auto-refresh on day change */}
      <DayChangeRefresh />

      {/* Status sections */}
      <AttendanceStatusSection
        status="present"
        rows={grouped.present}
        date={effectiveDate}
        workers={workers}
        defaultOpen
      />
      <AttendanceStatusSection
        status="leave"
        rows={grouped.leave}
        date={effectiveDate}
        workers={workers}
        defaultOpen={false}
      />
      <AttendanceStatusSection
        status="half_day"
        rows={grouped.half_day}
        date={effectiveDate}
        workers={workers}
        defaultOpen={false}
      />
      <AttendanceStatusSection
        status="absent"
        rows={grouped.absent}
        date={effectiveDate}
        workers={workers}
        defaultOpen={false}
      />
      <AttendanceStatusSection
        status="not_marked"
        rows={grouped.not_marked}
        date={effectiveDate}
        workers={workers}
        defaultOpen
      />

      {rows.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          No active workers found.
        </p>
      )}
    </>
  )
}

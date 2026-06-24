"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickAttendanceRow } from "@/components/hr/quick-attendance-row"

const SECTION_CONFIG = {
  present: { label: "Present", pill: "border border-emerald-500 text-emerald-600" },
  leave: { label: "On Leave", pill: "border border-blue-500 text-blue-600" },
  half_day: { label: "Half Day", pill: "border border-amber-500 text-amber-600" },
  absent: { label: "Absent", pill: "border border-red-500 text-red-600" },
  not_marked: {
    label: "Not Marked",
    pill: "border border-muted-foreground text-muted-foreground",
  },
} as const

type StatusKey = keyof typeof SECTION_CONFIG

interface WorkerRow {
  workerId: string
  workerName: string
  department: string | null
  attendance: {
    id: string
    status: string
    check_in: string | null
    check_out: string | null
    overtime_hours: number
  } | null
}

interface Worker {
  id: string
  full_name: string
  department: string | null
}

interface AttendanceStatusSectionProps {
  status: StatusKey
  rows: WorkerRow[]
  date: string
  workers: Worker[]
  defaultOpen?: boolean
}

export function AttendanceStatusSection({
  status,
  rows,
  date,
  workers,
  defaultOpen = true,
}: AttendanceStatusSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const config = SECTION_CONFIG[status]

  if (rows.length === 0) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold">{config.label}</span>
        <span
          className={cn(
            "rounded-full bg-transparent px-2 py-0.5 text-xs font-medium",
            config.pill
          )}
        >
          {rows.length}
        </span>
      </button>

      {open && (
        <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map((row) => (
            <QuickAttendanceRow
              key={row.workerId}
              workerId={row.workerId}
              workerName={row.workerName}
              department={row.department}
              currentStatus={(row.attendance?.status as "present" | "absent" | "half_day" | "leave" | undefined) ?? null}
              date={date}
              workers={workers}
            />
          ))}
        </div>
      )}
    </div>
  )
}

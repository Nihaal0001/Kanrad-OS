"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { AttendanceForm } from "@/components/hr/attendance-form"

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
            <AttendanceForm
              key={row.workerId}
              workers={workers}
              defaultWorkerId={row.workerId}
              defaultDate={date}
              trigger={
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50">
                  {/* Initials avatar */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {(row.workerName ?? "?")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>

                  {/* Name + department */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.workerName}</p>
                    {row.department && (
                      <p className="truncate text-xs text-muted-foreground">{row.department}</p>
                    )}
                  </div>

                  {/* Check-in / check-out / OT — only for present/half_day */}
                  {row.attendance &&
                    ["present", "half_day"].includes(row.attendance.status) && (
                      <div className="hidden shrink-0 items-center gap-3 text-xs text-muted-foreground sm:flex">
                        {row.attendance.check_in && (
                          <span>{row.attendance.check_in}</span>
                        )}
                        {row.attendance.check_out && (
                          <span>→ {row.attendance.check_out}</span>
                        )}
                        {row.attendance.overtime_hours > 0 && (
                          <span className="font-medium text-amber-600">
                            {row.attendance.overtime_hours}h OT
                          </span>
                        )}
                      </div>
                    )}

                  {/* Status badge */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full bg-transparent px-2.5 py-0.5 text-xs font-medium",
                      config.pill
                    )}
                  >
                    {config.label}
                  </span>
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

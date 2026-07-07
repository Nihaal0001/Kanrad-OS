"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { quickMarkAttendance } from "@/actions/hr"
import { AttendanceForm } from "@/components/hr/attendance-form"

type Status = "present" | "absent" | "half_day" | "leave"

interface Worker {
  id: string
  full_name: string
  department: string | null
  gender?: "male" | "female" | null
  ot_rate?: number | null
}

interface QuickAttendanceRowProps {
  workerId: string
  workerName: string
  department: string | null
  currentStatus: Status | null
  date: string
  workers: Worker[]
}

const OPTIONS: { status: Status; label: string; active: string }[] = [
  { status: "present", label: "P", active: "bg-emerald-600 text-white border-emerald-600" },
  { status: "absent", label: "A", active: "bg-red-600 text-white border-red-600" },
  { status: "half_day", label: "H", active: "bg-amber-500 text-white border-amber-500" },
  { status: "leave", label: "L", active: "bg-blue-600 text-white border-blue-600" },
]

export function QuickAttendanceRow({
  workerId,
  workerName,
  department,
  currentStatus,
  date,
  workers,
}: QuickAttendanceRowProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function mark(status: Status) {
    startTransition(async () => {
      const result = await quickMarkAttendance(workerId, date, status)
      if (result && "error" in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    })
  }

  const initials = (workerName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* Name opens the detailed dialog (check-in/out, OT) */}
      <AttendanceForm
        workers={workers}
        defaultWorkerId={workerId}
        defaultDate={date}
        trigger={
          <button className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
              <span className="text-xs font-semibold text-muted-foreground">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{workerName}</p>
              {department && <p className="truncate text-xs text-muted-foreground">{department}</p>}
            </div>
          </button>
        }
      />

      {/* One-tap status buttons */}
      <div className="flex shrink-0 items-center gap-1">
        {OPTIONS.map((opt) => {
          const isActive = currentStatus === opt.status
          return (
            <button
              key={opt.status}
              onClick={() => mark(opt.status)}
              disabled={isPending}
              title={opt.status.replace("_", " ")}
              className={cn(
                "h-8 w-8 rounded-full border text-xs font-bold transition-colors disabled:opacity-50",
                isActive ? opt.active : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

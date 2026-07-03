"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { format, addDays, parseISO } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"

interface AttendanceDateFilterProps {
  value: string
  type: "date"
}

interface PayrollMonthFilterProps {
  value: string
  type: "month"
}

type DateFilterProps = AttendanceDateFilterProps | PayrollMonthFilterProps

export function HRDateFilter({ value, type }: DateFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParam = useCallback(
    (key: string, val: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (val) {
        params.set(key, val)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(type === "date" ? "date" : "month")
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams, type])

  if (type === "date") {
    return (
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Filter by date</Label>
          <div className="w-44">
            <DatePicker
              value={value || undefined}
              onChange={(v) => updateParam("date", v)}
              placeholder="Pick a date"
            />
          </div>
        </div>
        {value && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clear}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  // month filter (used by payroll page)
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Filter by month</Label>
        <Input
          type="month"
          value={value}
          onChange={(e) => {
            // native month inputs fire onChange on every keystroke in some
            // browsers (e.g. typing a letter to jump to a month) — only
            // navigate once the value is a complete "YYYY-MM", or empty
            const v = e.target.value
            if (v === "" || /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) updateParam("month", v)
          }}
          className="h-9 w-44"
        />
      </div>
      {value && (
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

// ===== Attendance date navigation (prev/next/today) =====

interface AttendanceDateNavProps {
  date: string // YYYY-MM-DD, always provided
}

export function AttendanceDateNav({ date }: AttendanceDateNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const today = new Date().toISOString().split("T")[0]
  const isToday = date === today

  function navigate(offset: number) {
    const d = addDays(parseISO(date), offset)
    router.push(`${pathname}?date=${format(d, "yyyy-MM-dd")}`)
  }

  function jumpToDate(newDate: string) {
    router.push(`${pathname}?date=${newDate}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <DatePicker
        value={date}
        onChange={jumpToDate}
        disableFuture
        className="min-w-[170px] h-8"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(1)}
        disabled={isToday}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isToday && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 ml-1"
          onClick={() => router.push(pathname)}
        >
          Today
        </Button>
      )}
    </div>
  )
}

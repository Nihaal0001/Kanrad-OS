"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { X } from "lucide-react"

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
          <Input
            type="date"
            value={value}
            onChange={(e) => updateParam("date", e.target.value)}
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

  // month filter
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Filter by month</Label>
        <Input
          type="month"
          value={value}
          onChange={(e) => updateParam("month", e.target.value)}
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

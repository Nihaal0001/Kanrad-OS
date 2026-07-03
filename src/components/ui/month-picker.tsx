"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

interface MonthPickerProps {
  value?: string // "YYYY-MM"
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function MonthPicker({
  value,
  onChange,
  placeholder = "Pick a month",
  disabled,
  className,
}: MonthPickerProps) {
  const [open, setOpen] = useState(false)

  const [selYear, selMonth] = value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? [Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1]
    : [undefined, undefined]

  const [viewYear, setViewYear] = useState(selYear ?? new Date().getFullYear())

  function pick(monthIndex: number) {
    const mm = String(monthIndex + 1).padStart(2, "0")
    onChange?.(`${viewYear}-${mm}`)
    setOpen(false)
  }

  const label = selYear != null && selMonth != null
    ? `${MONTH_LABELS[selMonth]} ${selYear}`
    : placeholder

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setViewYear(selYear ?? new Date().getFullYear()) }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            selYear == null && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{viewYear}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTH_LABELS.map((label, i) => {
            const isSelected = selYear === viewYear && selMonth === i
            return (
              <button
                key={label}
                type="button"
                onClick={() => pick(i)}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-foreground"
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

"use client"

import { Clock } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value?: string // HH:MM
  onChange?: (value: string) => void
  disabled?: boolean
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
  const [hourPart, minutePart] = (value ?? ":").split(":")

  function handleHour(h: string) {
    const m = minutePart && minutePart !== "" ? minutePart : "00"
    onChange?.(`${h}:${m}`)
  }

  function handleMinute(m: string) {
    const h = hourPart && hourPart !== "" ? hourPart : "00"
    onChange?.(`${h}:${m}`)
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={hourPart || undefined} onValueChange={handleHour} disabled={disabled}>
        <SelectTrigger className="w-[68px]">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-52">
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm font-semibold text-muted-foreground">:</span>
      <Select value={minutePart || undefined} onValueChange={handleMinute} disabled={disabled}>
        <SelectTrigger className="w-[68px]">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

"use client"

import { useState } from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

interface DatePickerProps {
  value?: string // YYYY-MM-DD
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  disableFuture?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled,
  disableFuture,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const validSelected = selected && isValid(selected) ? selected : undefined

  function handleSelect(date: Date | undefined) {
    if (!date) return
    onChange?.(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !validSelected && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          {validSelected ? format(validSelected, "d MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={validSelected}
          onSelect={handleSelect}
          disabled={disableFuture ? { after: new Date() } : undefined}
        />
      </PopoverContent>
    </Popover>
  )
}

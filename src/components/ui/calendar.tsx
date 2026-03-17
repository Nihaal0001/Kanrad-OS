"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = DayPickerProps

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-1 flex justify-between px-1",
        button_previous: [
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "flex items-center justify-center rounded-md border border-input hover:bg-accent transition-colors",
        ].join(" "),
        button_next: [
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          "flex items-center justify-center rounded-md border border-input hover:bg-accent transition-colors",
        ].join(" "),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 font-normal text-[0.8rem] text-center pb-1",
        week: "flex w-full mt-1",
        day: "text-center text-sm p-0 relative",
        day_button: [
          "h-9 w-9 rounded-md p-0 font-normal transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ].join(" "),
        selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&:not([aria-selected])>button]:bg-accent [&:not([aria-selected])>button]:text-accent-foreground [&:not([aria-selected])>button]:font-semibold",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-40",
        disabled: "[&>button]:text-muted-foreground [&>button]:opacity-30 [&>button]:cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron({ orientation }) {
          return orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        },
      }}
      {...props}
    />
  )
}

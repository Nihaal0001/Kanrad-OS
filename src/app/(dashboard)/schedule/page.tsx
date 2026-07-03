import { getProductionSchedule, getShiftRoster } from "@/actions/analytics"
import { ScheduleClient } from "./schedule-client"

interface Props {
  searchParams: Promise<{ week?: string; tab?: string }>
}

/** Snap any date to its week's Monday (ISO date string). */
function mondayOf(date: Date): string {
  const dow = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1))
  return monday.toISOString().split("T")[0]
}

export default async function SchedulePage({ searchParams }: Props) {
  const { week, tab } = await searchParams

  const weekStart =
    week && /^\d{4}-\d{2}-\d{2}$/.test(week) && !isNaN(new Date(week).getTime())
      ? mondayOf(new Date(week))
      : mondayOf(new Date())

  const [orders, roster] = await Promise.all([
    getProductionSchedule(),
    getShiftRoster(weekStart),
  ])

  return (
    <ScheduleClient
      orders={orders}
      roster={roster}
      weekStart={weekStart}
      initialTab={tab === "shifts" ? "shifts" : "production"}
    />
  )
}

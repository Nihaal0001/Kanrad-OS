import { getProductionSchedule, getShiftRoster } from "@/actions/analytics"
import { ScheduleClient } from "./schedule-client"

export default async function SchedulePage() {
  // Default to current week
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekStart = monday.toISOString().split("T")[0]

  const [orders, roster] = await Promise.all([
    getProductionSchedule(),
    getShiftRoster(weekStart),
  ])

  return <ScheduleClient orders={orders} roster={roster} weekStart={weekStart} />
}

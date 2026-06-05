"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Calendar, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  in_production: "bg-amber-500/15 text-amber-600 border-amber-500/20",
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-emerald-500/20 text-emerald-700",
  absent: "bg-red-500/20 text-red-700",
  half_day: "bg-amber-500/20 text-amber-700",
  leave: "bg-purple-500/20 text-purple-700",
}

type Order = {
  id: string; order_number: string; product_variant: string; total_quantity: number
  deadline: string; status: string; priority: string
  customer: { name: string } | null
}
type Roster = {
  workers: { id: string; full_name: string; department: string | null }[]
  attendance: { worker_id: string; date: string; status: string; shift: { name: string; start_time: string; end_time: string } | null }[]
  shifts: { id: string; name: string; start_time: string; end_time: string }[]
}

export function ScheduleClient({ orders, roster, weekStart }: {
  orders: Order[]
  roster: Roster
  weekStart: string
}) {
  const [tab, setTab] = useState<"production" | "shifts">("production")
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [currentWeek, setCurrentWeek] = useState(weekStart)

  // Build calendar days for month view
  const firstDay = new Date(viewMonth.year, viewMonth.month, 1)
  const lastDay = new Date(viewMonth.year, viewMonth.month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0
  const totalCells = Math.ceil((startDow + lastDay.getDate()) / 7) * 7

  const calendarDays: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startDow + 1
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null
    return new Date(viewMonth.year, viewMonth.month, dayNum)
  })

  // Group orders by deadline date
  const ordersByDate = new Map<string, Order[]>()
  for (const o of orders) {
    if (!o.deadline) continue
    const key = o.deadline.slice(0, 10)
    if (!ordersByDate.has(key)) ordersByDate.set(key, [])
    ordersByDate.get(key)!.push(o)
  }

  // Week days for shift view
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() + i)
    return d.toISOString().split("T")[0]
  })

  // Build attendance map: worker_id → date → attendance
  const attMap = new Map<string, Map<string, typeof roster.attendance[0]>>()
  for (const a of roster.attendance) {
    if (!attMap.has(a.worker_id)) attMap.set(a.worker_id, new Map())
    attMap.get(a.worker_id)!.set(a.date, a)
  }

  function prevMonth() {
    setViewMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })
  }
  function nextMonth() {
    setViewMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })
  }
  function prevWeek() {
    const d = new Date(currentWeek); d.setDate(d.getDate() - 7)
    setCurrentWeek(d.toISOString().split("T")[0])
  }
  function nextWeek() {
    const d = new Date(currentWeek); d.setDate(d.getDate() + 7)
    setCurrentWeek(d.toISOString().split("T")[0])
  }

  const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleString("en-IN", { month: "long", year: "numeric" })
  const weekLabel = `${new Date(weekDays[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(weekDays[6]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
  const todayStr = new Date().toISOString().split("T")[0]

  const upcomingOrders = orders
    .filter(o => o.deadline >= todayStr)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 8)

  const overdueOrders = orders.filter(o => o.deadline < todayStr && o.status !== "dispatched" && o.status !== "completed")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">Production calendar and shift roster</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["production", "shifts"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all capitalize",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "production" ? "Production Calendar" : "Shift Roster"}
          </button>
        ))}
      </div>

      {/* Production Calendar */}
      {tab === "production" && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="font-semibold">{monthLabel}</h2>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7">
              {DAYS.map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground border-b border-border">{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const key = day?.toISOString().split("T")[0]
                const dayOrders = key ? (ordersByDate.get(key) ?? []) : []
                const isToday = key === todayStr
                return (
                  <div key={i} className={cn(
                    "min-h-[80px] p-1.5 border-b border-r border-border/50 text-xs",
                    !day && "bg-muted/20",
                    isToday && "bg-primary/5"
                  )}>
                    {day && (
                      <>
                        <div className={cn("w-6 h-6 flex items-center justify-center rounded-full mb-1 font-medium",
                          isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-0.5">
                          {dayOrders.slice(0, 2).map(o => (
                            <Link key={o.id} href={`/orders/${o.id}`}
                              className={cn("block truncate rounded px-1 py-0.5 text-[10px] font-medium border",
                                STATUS_COLORS[o.status] ?? "bg-muted text-muted-foreground"
                              )}>
                              {o.order_number}
                            </Link>
                          ))}
                          {dayOrders.length > 2 && (
                            <div className="text-[10px] text-muted-foreground px-1">+{dayOrders.length - 2} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {overdueOrders.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4">
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">
                  ⚠ {overdueOrders.length} Overdue
                </h3>
                <div className="space-y-2">
                  {overdueOrders.slice(0, 4).map(o => (
                    <Link key={o.id} href={`/orders/${o.id}`}
                      className="flex items-center justify-between text-xs hover:underline">
                      <span className="font-medium">{o.order_number}</span>
                      <span className="text-muted-foreground">{new Date(o.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Upcoming Deadlines
              </h3>
              {upcomingOrders.length === 0 ? (
                <p className="text-xs text-muted-foreground">No upcoming orders</p>
              ) : (
                <div className="space-y-3">
                  {upcomingOrders.map(o => (
                    <Link key={o.id} href={`/orders/${o.id}`}
                      className="flex items-start justify-between gap-2 group">
                      <div className="min-w-0">
                        <div className="text-sm font-medium group-hover:underline">{o.order_number}</div>
                        <div className="text-xs text-muted-foreground truncate">{o.customer?.name ?? o.product_variant}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-medium">{new Date(o.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                        <StatusBadge status={o.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shift Roster */}
      {tab === "shifts" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={prevWeek}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium min-w-[200px] text-center">{weekLabel}</span>
            <Button variant="outline" size="icon" onClick={nextWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-40">Worker</th>
                  {weekDays.map(d => (
                    <th key={d} className={cn("px-2 py-3 text-center font-medium text-muted-foreground",
                      d === todayStr && "text-primary"
                    )}>
                      <div>{DAYS[weekDays.indexOf(d)]}</div>
                      <div className={cn("text-xs", d === todayStr ? "text-primary font-bold" : "text-muted-foreground/70")}>
                        {new Date(d).getDate()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {roster.workers.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No workers found</td></tr>
                )}
                {roster.workers.map(w => (
                  <tr key={w.id} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{w.full_name}</div>
                      {w.department && <div className="text-muted-foreground">{w.department}</div>}
                    </td>
                    {weekDays.map(d => {
                      const att = attMap.get(w.id)?.get(d)
                      return (
                        <td key={d} className="px-2 py-2 text-center">
                          {att ? (
                            <div className={cn("rounded px-1.5 py-1 text-center capitalize", ATTENDANCE_COLORS[att.status] ?? "bg-muted text-muted-foreground")}>
                              <div>{att.status.replace("_", " ")}</div>
                              {att.shift && <div className="text-[10px] opacity-70">{att.shift.name}</div>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {roster.shifts.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {roster.shifts.map(s => (
                <div key={s.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground ml-2">{s.start_time} – {s.end_time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

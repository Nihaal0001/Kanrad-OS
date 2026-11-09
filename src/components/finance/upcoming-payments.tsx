"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, List, Scale } from "lucide-react"

import type { UpcomingPayment } from "@/actions/upcoming-payments"
import { addDaysISO } from "@/lib/payment-terms"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

function dueLabel(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`
  if (days === 0) return "Due today"
  if (days === 1) return "Due tomorrow"
  return `In ${days} days`
}

function Row({ p, today }: { p: UpcomingPayment; today: string }) {
  const days = daysBetween(today, p.due_date)
  const incoming = p.direction === "incoming"
  return (
    <Link
      href={p.href}
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          incoming ? "bg-emerald-500/10 text-emerald-600" : "bg-orange-500/10 text-orange-600"
        )}
      >
        {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{p.party}</p>
        <p className="truncate text-xs text-muted-foreground">
          {p.reference} · {incoming ? "to receive" : "to pay"}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-sm">{formatDate(p.due_date)}</p>
        <Badge variant={days < 0 ? "destructive" : days <= 7 ? "default" : "secondary"} className="text-xs">
          {dueLabel(days)}
        </Badge>
      </div>
      <p
        className={cn(
          "w-28 shrink-0 text-right text-sm font-semibold",
          incoming ? "text-emerald-600" : "text-orange-600"
        )}
      >
        {incoming ? "+" : "−"}
        {formatCurrency(p.amount)}
      </p>
    </Link>
  )
}

function Schedule({ items, today }: { items: UpcomingPayment[]; today: string }) {
  const weekEnd = addDaysISO(today, 7)
  const groups = [
    { label: "Overdue", rows: items.filter((p) => p.due_date < today) },
    { label: "Due today", rows: items.filter((p) => p.due_date === today) },
    { label: "Next 7 days", rows: items.filter((p) => p.due_date > today && p.due_date <= weekEnd) },
    { label: "Later", rows: items.filter((p) => p.due_date > weekEnd) },
  ].filter((g) => g.rows.length > 0)

  if (groups.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g.label} ({g.rows.length})
          </h3>
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {g.rows.map((p) => (
              <Row key={`${p.direction}-${p.id}`} p={p} today={today} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function formatCompact(n: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n)}`
}

function shiftMonth(ym: string, delta: number): string {
  const d = new Date(`${ym}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 7)
}

function monthTitle(ym: string): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${ym}-01T00:00:00Z`)
  )
}

function totals(rows: UpcomingPayment[]) {
  let inc = 0
  let out = 0
  for (const p of rows) {
    if (p.direction === "incoming") inc += p.amount
    else out += p.amount
  }
  return { inc, out }
}

function CalendarView({ items, today }: { items: UpcomingPayment[]; today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)

  const byDay = useMemo(() => {
    const map = new Map<string, UpcomingPayment[]>()
    for (const p of items) {
      const list = map.get(p.due_date) ?? []
      list.push(p)
      map.set(p.due_date, list)
    }
    return map
  }, [items])

  // Grid starts on the Sunday on/before the 1st and always covers whole weeks
  const first = new Date(`${month}-01T00:00:00Z`)
  const gridStart = addDaysISO(`${month}-01`, -first.getUTCDay())
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const weeks = Math.ceil((first.getUTCDay() + daysInMonth) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDaysISO(gridStart, i))

  const monthRows = items.filter((p) => p.due_date.startsWith(month))
  const monthTotals = totals(monthRows)
  const dayRows = byDay.get(selected) ?? []
  const dayTotals = totals(dayRows)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="min-w-40 text-center text-base font-semibold">{monthTitle(month)}</h3>
            <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMonth(today.slice(0, 7))
                setSelected(today)
              }}
            >
              Today
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {monthTitle(month)}:{" "}
            <span className="font-medium text-orange-600">Pay {formatCurrency(monthTotals.out)}</span>
            {" · "}
            <span className="font-medium text-emerald-600">Receive {formatCurrency(monthTotals.inc)}</span>
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-1 py-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const rows = byDay.get(date) ?? []
              const t = totals(rows)
              const inMonth = date.startsWith(month)
              const isToday = date === today
              const isSelected = date === selected
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelected(date)}
                  className={cn(
                    "flex min-h-[72px] flex-col items-stretch gap-0.5 border-b border-r border-border p-1 text-left transition-colors hover:bg-muted/50 sm:min-h-[92px] sm:p-1.5",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    isSelected && "bg-primary/10 ring-1 ring-inset ring-primary",
                    rows.length > 0 && date < today && "bg-destructive/5"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {t.out > 0 && (
                    <span className="truncate text-[10px] font-semibold leading-tight text-orange-600 sm:text-xs">
                      −{formatCompact(t.out)}
                    </span>
                  )}
                  {t.inc > 0 && (
                    <span className="truncate text-[10px] font-semibold leading-tight text-emerald-600 sm:text-xs">
                      +{formatCompact(t.inc)}
                    </span>
                  )}
                  {rows.length > 0 && (
                    <span className="hidden text-[10px] text-muted-foreground sm:block">
                      {rows.length} item{rows.length > 1 ? "s" : ""}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div>
          <h3 className="text-base font-semibold">{formatDate(selected)}</h3>
          <p className="text-xs text-muted-foreground">{dueLabel(daysBetween(today, selected))}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[11px] text-muted-foreground">To pay</p>
            <p className="text-sm font-semibold text-orange-600">{formatCurrency(dayTotals.out)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[11px] text-muted-foreground">To receive</p>
            <p className="text-sm font-semibold text-emerald-600">{formatCurrency(dayTotals.inc)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2">
            <p className="text-[11px] text-muted-foreground">Net</p>
            <p className={cn("text-sm font-semibold", dayTotals.inc - dayTotals.out < 0 && "text-destructive")}>
              {formatCurrency(dayTotals.inc - dayTotals.out)}
            </p>
          </div>
        </div>
        {dayRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No payments on this day.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {[...dayRows]
              .sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === "outgoing" ? -1 : 1))
              .map((p) => (
                <Row key={`${p.direction}-${p.id}`} p={p} today={today} />
              ))}
          </div>
        )}
      </aside>
    </div>
  )
}

export function UpcomingPayments({ payments, today }: { payments: UpcomingPayment[]; today: string }) {
  const [filter, setFilter] = useState<"all" | "incoming" | "outgoing">("all")
  const [view, setView] = useState<"list" | "calendar">("calendar")

  const incoming = payments.filter((p) => p.direction === "incoming")
  const outgoing = payments.filter((p) => p.direction === "outgoing")
  const sum = (rows: UpcomingPayment[]) => rows.reduce((s, p) => s + p.amount, 0)
  const net = sum(incoming) - sum(outgoing)
  const shown = filter === "all" ? payments : filter === "incoming" ? incoming : outgoing

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Incoming</p>
              <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(sum(incoming))}</p>
              <p className="text-xs text-muted-foreground">{incoming.length} invoices</p>
            </div>
            <ArrowDownLeft className="h-6 w-6 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Outgoing</p>
              <p className="text-2xl font-semibold text-orange-600">{formatCurrency(sum(outgoing))}</p>
              <p className="text-xs text-muted-foreground">{outgoing.length} bills</p>
            </div>
            <ArrowUpRight className="h-6 w-6 text-orange-600" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Net position</p>
              <p className={cn("text-2xl font-semibold", net < 0 ? "text-destructive" : "text-foreground")}>
                {formatCurrency(net)}
              </p>
              <p className="text-xs text-muted-foreground">incoming − outgoing</p>
            </div>
            <Scale className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
            <TabsTrigger value="incoming">Incoming ({incoming.length})</TabsTrigger>
            <TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" onClick={() => setView("calendar")}>
            <CalendarDays className="mr-1.5 h-4 w-4" /> Calendar
          </Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
            <List className="mr-1.5 h-4 w-4" /> List
          </Button>
        </div>
      </div>

      {view === "calendar" ? <CalendarView items={shown} today={today} /> : <Schedule items={shown} today={today} />}
    </div>
  )
}

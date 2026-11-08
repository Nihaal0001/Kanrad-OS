"use client"

import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react"

import type { UpcomingPayment } from "@/actions/upcoming-payments"
import { addDaysISO } from "@/lib/payment-terms"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

export function UpcomingPayments({ payments, today }: { payments: UpcomingPayment[]; today: string }) {
  const incoming = payments.filter((p) => p.direction === "incoming")
  const outgoing = payments.filter((p) => p.direction === "outgoing")
  const sum = (rows: UpcomingPayment[]) => rows.reduce((s, p) => s + p.amount, 0)
  const net = sum(incoming) - sum(outgoing)

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

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({payments.length})</TabsTrigger>
          <TabsTrigger value="incoming">Incoming ({incoming.length})</TabsTrigger>
          <TabsTrigger value="outgoing">Outgoing ({outgoing.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">
          <Schedule items={payments} today={today} />
        </TabsContent>
        <TabsContent value="incoming" className="mt-4">
          <Schedule items={incoming} today={today} />
        </TabsContent>
        <TabsContent value="outgoing" className="mt-4">
          <Schedule items={outgoing} today={today} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

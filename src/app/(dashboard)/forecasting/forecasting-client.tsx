"use client"

import { useState } from "react"
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DemandData = {
  actuals: { month: string; label: string; count: number; quantity: number }[]
  projections: { month: string; label: string; count: number; projected: boolean }[]
  trend: "up" | "down" | "stable"
}
type InventoryItem = {
  id: string; name: string; sku: string; unit: string; current_stock: number; min_stock_level: number
  category: { name: string } | null
  weeklyUsage: number; weeksLeft: number | null; stockoutDate: string | null
  status: "critical" | "low" | "ok" | "no_data"
}

const STATUS_CONFIG = {
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  low: { label: "Low", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
  ok: { label: "OK", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-500" },
  no_data: { label: "No data", color: "text-muted-foreground", bg: "bg-muted/40 border-border", dot: "bg-muted-foreground/40" },
}

export function ForecastingClient({ demand, inventory }: { demand: DemandData; inventory: InventoryItem[] }) {
  const [tab, setTab] = useState<"demand" | "inventory">("demand")
  const [invFilter, setInvFilter] = useState<"all" | "critical" | "low">("all")

  const chartData = [
    ...demand.actuals.map(a => ({ ...a, type: "actual" as const })),
    ...demand.projections.map(p => ({ ...p, type: "projected" as const })),
  ]

  const splitIndex = demand.actuals.length - 1

  const TrendIcon = demand.trend === "up" ? TrendingUp : demand.trend === "down" ? TrendingDown : Minus
  const trendColor = demand.trend === "up" ? "text-emerald-600" : demand.trend === "down" ? "text-red-600" : "text-muted-foreground"

  const critical = inventory.filter(i => i.status === "critical")
  const low = inventory.filter(i => i.status === "low")
  const filteredInventory = invFilter === "all" ? inventory : inventory.filter(i => i.status === invFilter)

  const totalOrders = demand.actuals.reduce((s, a) => s + a.count, 0)
  const avgMonthly = Math.round(totalOrders / (demand.actuals.filter(a => a.count > 0).length || 1))
  const nextMonthForecast = demand.projections[0]?.count ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forecasting</h1>
        <p className="mt-1 text-sm text-muted-foreground">Demand trends and inventory depletion predictions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["demand", "inventory"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "demand" ? "Demand Forecast" : "Inventory Forecast"}
          </button>
        ))}
      </div>

      {/* Demand Tab */}
      {tab === "demand" && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">6-Month Total</p>
                <p className="text-3xl font-bold mt-1">{totalOrders}</p>
                <p className="text-xs text-muted-foreground mt-0.5">orders placed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Avg / Month</p>
                <p className="text-3xl font-bold mt-1">{avgMonthly}</p>
                <p className="text-xs text-muted-foreground mt-0.5">orders per month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Next Month Forecast</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold">{nextMonthForecast}</p>
                  <TrendIcon className={cn("h-5 w-5", trendColor)} />
                </div>
                <p className={cn("text-xs mt-0.5 capitalize font-medium", trendColor)}>
                  {demand.trend === "up" ? "Growing trend" : demand.trend === "down" ? "Declining trend" : "Stable trend"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Orders Per Month — Actual vs Projected</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(v) => [v, "Orders"]}
                  />
                  <ReferenceLine x={demand.actuals[splitIndex]?.label} stroke="hsl(var(--border))" strokeDasharray="4 4" label={{ value: "Forecast →", fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.type === "projected" ? "#60a5fa" : "#2563eb"} opacity={d.type === "projected" ? 0.5 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Solid bars = actual orders · Faded bars = linear trend projection
              </p>
            </CardContent>
          </Card>

          {/* Monthly breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {demand.actuals.map(a => (
                  <div key={a.month} className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-16">{a.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (a.count / (Math.max(...demand.actuals.map(x => x.count)) || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">{a.count} orders</span>
                    <span className="text-xs text-muted-foreground w-24 text-right">{a.quantity.toLocaleString("en-IN")} pcs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Inventory Tab */}
      {tab === "inventory" && (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={cn("rounded-xl border p-4 cursor-pointer transition-all", invFilter === "critical" ? "ring-2 ring-red-500" : "", STATUS_CONFIG.critical.bg)}
              onClick={() => setInvFilter(f => f === "critical" ? "all" : "critical")}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium text-red-600">Critical (&lt;2 weeks)</span>
              </div>
              <p className="text-3xl font-bold text-red-600 mt-2">{critical.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">materials running out soon</p>
            </div>
            <div className={cn("rounded-xl border p-4 cursor-pointer transition-all", invFilter === "low" ? "ring-2 ring-amber-500" : "", STATUS_CONFIG.low.bg)}
              onClick={() => setInvFilter(f => f === "low" ? "all" : "low")}>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-600">Low (2–4 weeks)</span>
              </div>
              <p className="text-3xl font-bold text-amber-600 mt-2">{low.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">materials need attention</p>
            </div>
            <div className={cn("rounded-xl border p-4", STATUS_CONFIG.ok.bg)}>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-sm font-medium text-emerald-600">Healthy (&gt;4 weeks)</span>
              </div>
              <p className="text-3xl font-bold text-emerald-600 mt-2">{inventory.filter(i => i.status === "ok").length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">materials well stocked</p>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-medium text-sm">
                {invFilter === "all" ? "All Materials" : `${invFilter.charAt(0).toUpperCase() + invFilter.slice(1)} Stock`}
                <span className="text-muted-foreground ml-2">({filteredInventory.length})</span>
              </h3>
              {invFilter !== "all" && (
                <button onClick={() => setInvFilter("all")} className="text-xs text-primary hover:underline">Clear filter</button>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Material</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Current Stock</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Weekly Usage</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Weeks Left</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stockout Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInventory.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">No materials match this filter</td></tr>
                )}
                {filteredInventory.map(m => {
                  const cfg = STATUS_CONFIG[m.status]
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.sku} · {m.category?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {m.current_stock.toLocaleString("en-IN")} {m.unit}
                        {m.min_stock_level > 0 && m.current_stock <= m.min_stock_level && (
                          <div className="text-[10px] text-red-500">Below min ({m.min_stock_level})</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {m.weeklyUsage > 0 ? `${m.weeklyUsage} ${m.unit}/wk` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {m.weeksLeft !== null ? `${m.weeksLeft} wks` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {m.stockoutDate
                          ? new Date(m.stockoutDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border", cfg.bg, cfg.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            * Based on stock transactions from the last 90 days. Materials with no recorded outflow show no data.
          </p>
        </div>
      )}
    </div>
  )
}

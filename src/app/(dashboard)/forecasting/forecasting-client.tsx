"use client"

import { useState } from "react"
import { BarChart, Bar, Cell, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { useTheme } from "next-themes"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Package, Download } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TallySourceBadge } from "@/components/finance/tally-source-badge"
import { ForecastCard } from "@/components/market-intel/forecast-card"
import { downloadCSV } from "@/lib/export"
import { cn } from "@/lib/utils"
import type { SalesForecast } from "@/actions/analytics"

type DemandData = {
  actuals: { month: string; label: string; count: number; quantity: number }[]
  projections: { month: string; label: string; count: number; projected: boolean }[]
  trend: "up" | "down" | "stable"
}
type InventoryItem = {
  id: string; name: string; sku: string; unit: string; current_stock: number; min_stock_level: number
  category: { name: string } | null
  weeklyUsage: number; weeksLeft: number | null; stockoutDate: string | null
  reorderQty: number
  status: "critical" | "low" | "ok" | "no_data"
}

const STATUS_CONFIG = {
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  low: { label: "Low", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
  ok: { label: "OK", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-500" },
  no_data: { label: "No data", color: "text-muted-foreground", bg: "bg-muted/40 border-border", dot: "bg-muted-foreground/40" },
}

function fmtCompact(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function ForecastingClient({ demand, inventory, sales, forecastCommodities }: {
  demand: DemandData
  inventory: InventoryItem[]
  sales: SalesForecast
  forecastCommodities: { id: string; name: string }[]
}) {
  const [tab, setTab] = useState<"demand" | "inventory">("demand")
  const [invFilter, setInvFilter] = useState<"all" | "critical" | "low">("all")

  // Theme-aware chart colors — recharts SVG text doesn't pick up CSS vars reliably,
  // so resolve explicit colors that stay legible on both light and dark backgrounds.
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const axisColor = isDark ? "#e5e7eb" : "#1f2937"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#3f3f46" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  const actualBar = isDark ? "#3b82f6" : "#2563eb"
  const projectedBar = isDark ? "#93c5fd" : "#60a5fa"
  // sales identity color (cyan) + amber moving average, per validated palette
  const salesBar = "#0891b2"
  const maLine = "#d97706"

  const chartData = [
    ...demand.actuals.map(a => ({ ...a, type: "actual" as const })),
    ...demand.projections.map(p => ({ ...p, type: "projected" as const })),
  ]

  const splitIndex = demand.actuals.length - 1

  const TrendIcon = sales.trend === "up" ? TrendingUp : sales.trend === "down" ? TrendingDown : Minus
  const trendColor = sales.trend === "up" ? "text-emerald-600" : sales.trend === "down" ? "text-red-600" : "text-muted-foreground"

  const critical = inventory.filter(i => i.status === "critical")
  const low = inventory.filter(i => i.status === "low")
  const filteredInventory = invFilter === "all" ? inventory : inventory.filter(i => i.status === invFilter)

  const salesSplitLabel = sales.series.filter(s => !s.projected).at(-1)?.label

  function exportInventoryCsv() {
    downloadCSV(
      filteredInventory.map(m => ({
        sku: m.sku,
        name: m.name,
        category: m.category?.name ?? "",
        current_stock: m.current_stock,
        unit: m.unit,
        weekly_usage: m.weeklyUsage,
        weeks_left: m.weeksLeft ?? "",
        stockout_date: m.stockoutDate ?? "",
        reorder_qty: m.reorderQty,
        status: m.status,
      })),
      [
        { key: "sku", label: "SKU" },
        { key: "name", label: "Material" },
        { key: "category", label: "Category" },
        { key: "current_stock", label: "Current Stock" },
        { key: "unit", label: "Unit" },
        { key: "weekly_usage", label: "Weekly Usage" },
        { key: "weeks_left", label: "Weeks Left" },
        { key: "stockout_date", label: "Stockout Date" },
        { key: "reorder_qty", label: "Suggested Reorder Qty" },
        { key: "status", label: "Status" },
      ],
      `inventory-forecast-${new Date().toISOString().split("T")[0]}.csv`
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forecasting</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sales trends, demand projections and inventory runway</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["demand", "inventory"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "demand" ? "Sales & Demand" : "Inventory Forecast"}
          </button>
        ))}
      </div>

      {/* Sales & Demand Tab */}
      {tab === "demand" && (
        <div className="space-y-6">
          <TallySourceBadge isSample={sales.isSample} lastSyncedAt={null} />

          {/* Revenue KPI row */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Trailing 12-Month Sales</p>
                <p className="text-3xl font-bold mt-1">{fmtCompact(sales.kpis.trailing12mRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">net of credit notes</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Last Month Growth</p>
                <p className={cn("text-3xl font-bold mt-1", (sales.kpis.momGrowthPct ?? 0) > 0 ? "text-emerald-600" : (sales.kpis.momGrowthPct ?? 0) < 0 ? "text-red-600" : "")}>
                  {sales.kpis.momGrowthPct !== null ? `${sales.kpis.momGrowthPct > 0 ? "+" : ""}${sales.kpis.momGrowthPct}%` : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">month over month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Next Month Projection</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold">{fmtCompact(sales.kpis.nextMonthProjection)}</p>
                  <TrendIcon className={cn("h-5 w-5", trendColor)} />
                </div>
                <p className={cn("text-xs mt-0.5 capitalize font-medium", trendColor)}>
                  {sales.trend === "up" ? "Growing trend" : sales.trend === "down" ? "Declining trend" : "Stable trend"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Sales — Actual vs Projected</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={sales.series} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 12, fill: mutedColor }} axisLine={false} tickLine={false} width={64} />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12, color: axisColor }}
                    labelStyle={{ fontWeight: 600, color: axisColor }}
                    itemStyle={{ color: axisColor }}
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                    formatter={(v, name) => [
                      `₹${Number(v).toLocaleString("en-IN")}`,
                      name === "revenue" ? "Sales" : "3-month avg",
                    ]}
                  />
                  {salesSplitLabel && (
                    <ReferenceLine x={salesSplitLabel} stroke={mutedColor} strokeDasharray="4 4" label={{ value: "Forecast →", fill: mutedColor, fontSize: 11 }} />
                  )}
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {sales.series.map((d, i) => (
                      <Cell key={i} fill={salesBar} opacity={d.projected ? 0.45 : 1} />
                    ))}
                  </Bar>
                  <Line type="monotone" dataKey="ma3" name="ma3" stroke={maLine} strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Solid bars = actual monthly sales · Faded bars = linear projection · Amber line = 3-month moving average
              </p>
            </CardContent>
          </Card>

          {/* ERP orders (actual) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ERP Orders (actual)</CardTitle>
            </CardHeader>
            <CardContent>
              {demand.actuals.every(a => a.count === 0) ? (
                <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground gap-2">
                  <p className="text-sm font-medium">No order data yet</p>
                  <p className="text-xs">Orders will appear here once they are created in the system</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: axisColor }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: mutedColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12, color: axisColor }}
                        labelStyle={{ fontWeight: 600, color: axisColor }}
                        itemStyle={{ color: axisColor }}
                        cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                        formatter={(v) => [v, "Orders"]}
                      />
                      <ReferenceLine x={demand.actuals[splitIndex]?.label} stroke={mutedColor} strokeDasharray="4 4" label={{ value: "Forecast →", fill: mutedColor, fontSize: 11 }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {chartData.map((d, i) => (
                          <Cell key={i} fill={d.type === "projected" ? projectedBar : actualBar} opacity={d.type === "projected" ? 0.65 : 1} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Solid bars = actual orders · Faded bars = linear trend projection
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Commodity AI forecast */}
          <ForecastCard commodities={forecastCommodities} />
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
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <h3 className="font-medium text-sm">
                {invFilter === "all" ? "All Materials" : `${invFilter.charAt(0).toUpperCase() + invFilter.slice(1)} Stock`}
                <span className="text-muted-foreground ml-2">({filteredInventory.length})</span>
              </h3>
              <div className="flex items-center gap-3">
                {invFilter !== "all" && (
                  <button onClick={() => setInvFilter("all")} className="text-xs text-primary hover:underline">Clear filter</button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportInventoryCsv}>
                  <Download className="h-3.5 w-3.5 mr-1" /> CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Material</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Current Stock</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Weekly Usage</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Weeks Left</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Stockout Date</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Reorder Qty</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredInventory.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No materials match this filter</td></tr>
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
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {m.reorderQty > 0 ? `${m.reorderQty.toLocaleString("en-IN")} ${m.unit}` : "—"}
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
          </div>

          <p className="text-xs text-muted-foreground">
            * Based on stock transactions from the last 90 days. Reorder qty covers ~3 weeks of usage (2-week lead time + 1-week buffer) beyond current stock.
          </p>
        </div>
      )}
    </div>
  )
}

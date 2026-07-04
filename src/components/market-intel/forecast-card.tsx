"use client"

import { useState, useTransition } from "react"
import { TrendingUp, TrendingDown, Minus, Loader2, LineChart as LineChartIcon, AlertTriangle } from "lucide-react"
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getCommodityOutlook, type CommodityOutlook } from "@/actions/analytics"
import { cn } from "@/lib/utils"

interface ForecastCardProps {
  commodities: { id: string; name: string }[]
}

const STANCE_STYLES: Record<string, { label: string; cls: string }> = {
  "buy-early": { label: "Consider buying early", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  neutral: { label: "Neutral", cls: "bg-muted text-muted-foreground border-border" },
  wait: { label: "No rush to buy", cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20" },
}

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`
}

export function ForecastCard({ commodities }: ForecastCardProps) {
  const [, startTransition] = useTransition()
  const [commodityId, setCommodityId] = useState("")
  const [outlook, setOutlook] = useState<CommodityOutlook | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  const lineColor = isDark ? "#3987e5" : "#2a78d6"

  function handleRun() {
    if (!commodityId) return
    setLoading(true)
    setError("")
    setOutlook(null)
    startTransition(async () => {
      const res = await getCommodityOutlook(commodityId)
      setLoading(false)
      if ("error" in res) { setError(res.error); return }
      setOutlook(res.data)
    })
  }

  // history + projected band for the chart
  const chartData = outlook
    ? [
        ...outlook.history.map(h => ({
          label: new Date(h.date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          price: h.price,
          bandLow: null as number | null,
          bandHigh: null as number | null,
        })),
        ...(outlook.nextMonthRange
          ? [{
              label: "Next mo.",
              price: null as number | null,
              bandLow: outlook.nextMonthRange.low,
              bandHigh: outlook.nextMonthRange.high,
            }]
          : []),
        ...(outlook.threeMonthRange
          ? [{
              label: "+3 mo.",
              price: null as number | null,
              bandLow: outlook.threeMonthRange.low,
              bandHigh: outlook.threeMonthRange.high,
            }]
          : []),
      ]
    : []

  const lastLabel = outlook?.history.length
    ? new Date(outlook.history[outlook.history.length - 1].date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    : undefined

  const TrendIcon = (outlook?.trendPctPerMonth ?? 0) > 0.5 ? TrendingUp : (outlook?.trendPctPerMonth ?? 0) < -0.5 ? TrendingDown : Minus

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-primary" />
          Price Outlook
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Trend and expected range computed from actual price history (statistics, not AI guesses).
          AI adds only a qualitative read of demand/supply drivers from the news.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {commodities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log at least one commodity price to see an outlook.</p>
        ) : (
          <div className="flex gap-3">
            <Select value={commodityId} onValueChange={(v: string) => { setCommodityId(v); setOutlook(null); setError("") }}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select a commodity..." /></SelectTrigger>
              <SelectContent>
                {commodities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleRun} disabled={!commodityId || loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analysing…</> : "Show Outlook"}
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
        )}

        {outlook && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{outlook.material_name}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtInr(outlook.last_price)}/{outlook.unit} · {outlook.data_note}
                </p>
              </div>
              {outlook.ai && (
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", STANCE_STYLES[outlook.ai.stance].cls)}>
                  {STANCE_STYLES[outlook.ai.stance].label}
                </span>
              )}
            </div>

            {/* computed stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">3-mo trend</p>
                <p className="flex items-center gap-1 font-semibold text-sm mt-0.5">
                  <TrendIcon className={cn("h-3.5 w-3.5", (outlook.trendPctPerMonth ?? 0) > 0.5 ? "text-amber-600" : (outlook.trendPctPerMonth ?? 0) < -0.5 ? "text-cyan-600" : "text-muted-foreground")} />
                  {outlook.trendPctPerMonth !== null ? `${outlook.trendPctPerMonth > 0 ? "+" : ""}${outlook.trendPctPerMonth}%/mo` : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Typical swing</p>
                <p className="font-semibold text-sm mt-0.5">{outlook.volatilityPct !== null ? `±${outlook.volatilityPct}%/mo` : "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">12-mo range</p>
                <p className="font-semibold text-sm mt-0.5 tabular-nums">
                  {outlook.yearLow !== null && outlook.yearHigh !== null
                    ? `${fmtInr(outlook.yearLow)}–${fmtInr(outlook.yearHigh)}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Next month range</p>
                <p className="font-semibold text-sm mt-0.5 tabular-nums">
                  {outlook.nextMonthRange ? `${fmtInr(outlook.nextMonthRange.low)}–${fmtInr(outlook.nextMonthRange.high)}` : "need ≥4 months of data"}
                </p>
              </div>
            </div>

            {/* chart: history line + projected range band */}
            {chartData.length >= 3 && (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: mutedColor }} minTickGap={20} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: textColor }}
                    tickFormatter={(v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}K`)}
                    domain={["auto", "auto"]}
                    width={56}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: 8, fontSize: 12, color: textColor }}
                    labelStyle={{ color: textColor }}
                    itemStyle={{ color: textColor }}
                    formatter={(v, name) => [
                      `₹${Number(v).toLocaleString("en-IN")}`,
                      name === "price" ? "Benchmark" : name === "bandHigh" ? "Range high" : "Range low",
                    ]}
                  />
                  {lastLabel && <ReferenceLine x={lastLabel} stroke={mutedColor} strokeDasharray="3 3" label={{ value: "Projection →", fill: mutedColor, fontSize: 10 }} />}
                  <Area dataKey="bandHigh" stroke="transparent" fill={lineColor} fillOpacity={0.12} connectNulls />
                  <Area dataKey="bandLow" stroke="transparent" fill={tooltipBg} fillOpacity={1} connectNulls />
                  <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {/* AI drivers — qualitative only */}
            {outlook.ai ? (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-sm font-medium">Drivers &amp; risks from the news</p>
                <p className="text-sm text-muted-foreground">{outlook.ai.rationale}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {outlook.ai.drivers.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                      {outlook.ai.drivers.map((d, i) => <li key={i} className="list-disc">{d}</li>)}
                    </ul>
                  )}
                  {outlook.ai.risks.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                      {outlook.ai.risks.map((r, i) => <li key={i} className="list-disc marker:text-amber-500">{r}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            ) : outlook.aiError ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3 w-3" /> AI driver analysis unavailable ({outlook.aiError}) — statistical outlook above is unaffected.
              </p>
            ) : null}

            <p className="text-[10px] text-muted-foreground">
              Ranges are derived from this commodity&apos;s own historical monthly moves (trend ± one typical swing). They are planning bands, not guarantees.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

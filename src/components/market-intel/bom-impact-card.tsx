"use client"

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { useTheme } from "next-themes"
import { Factory, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { BomCostImpact } from "@/actions/market-intel"

// in/out identity pair used across the app — amber = cost up, cyan = cost down
const UP_COLOR = "#d97706"
const DOWN_COLOR = "#0891b2"

function fmtInr(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
}

export function BomImpactCard({ impact }: { impact: BomCostImpact }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"

  if (!impact.available) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          BOM cost impact: {impact.reason}.
        </CardContent>
      </Card>
    )
  }

  const top = impact.rows.slice(0, 10)
  const chartData = top.map(r => ({
    name: r.productSku,
    deltaPct: r.deltaPct,
    deltaAbs: r.deltaAbs,
    fullName: r.productName,
  }))
  const up = impact.aluDeltaPct >= 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Factory className="h-4 w-4 text-primary" />
          Product Cost Impact — Aluminium
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Aluminium moved{" "}
          <span className={cn("font-semibold", up ? "text-amber-600" : "text-cyan-700 dark:text-cyan-400")}>
            {up ? "+" : ""}{impact.aluDeltaPct}%
          </span>{" "}
          ({fmtInr(impact.aluThen)} → {fmtInr(impact.aluNow)}/MT, {formatDate(impact.baselineDate)} → {formatDate(impact.asOf)}).
          Effect on each product&apos;s material cost through its BOM:
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 34)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 48, left: 8, bottom: 4 }} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: mutedColor }}
                stroke={mutedColor}
              />
              <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11, fill: textColor }} stroke={mutedColor} />
              <Tooltip
                formatter={(value, name, entry) => [
                  `${Number(value) >= 0 ? "+" : ""}${Number(value)}% (${fmtInr((entry?.payload as { deltaAbs: number })?.deltaAbs ?? 0)})`,
                  "Cost change",
                ]}
                labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName ?? label}
                cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${gridColor}`,
                  borderRadius: "0.625rem",
                  fontSize: 13,
                  color: textColor,
                }}
                labelStyle={{ color: textColor }}
                itemStyle={{ color: textColor }}
              />
              <ReferenceLine x={0} stroke={mutedColor} />
              <Bar dataKey="deltaPct" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.deltaPct >= 0 ? UP_COLOR : DOWN_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Cost (then)</th>
                <th className="px-3 py-2 text-right font-medium">Cost (now)</th>
                <th className="px-3 py-2 text-right font-medium">Δ</th>
                <th className="px-3 py-2 text-right font-medium">Alu share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {top.map(r => (
                <tr key={r.bomId} className="hover:bg-muted/20">
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.productSku}</span>
                    <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">{r.productName}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtInr(r.costThen)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtInr(r.costNow)}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", r.deltaAbs >= 0 ? "text-amber-600" : "text-cyan-700 dark:text-cyan-400")}>
                    {r.deltaAbs >= 0 ? "+" : ""}{fmtInr(r.deltaAbs)} ({r.deltaPct >= 0 ? "+" : ""}{r.deltaPct}%)
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.aluSharePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Assumes aluminium-category material costs move with the benchmark; other materials held flat. Based on current BOM quantities and material rates.
        </p>
      </CardContent>
    </Card>
  )
}

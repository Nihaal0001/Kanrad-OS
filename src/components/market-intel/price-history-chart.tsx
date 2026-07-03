"use client"

import { useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface PriceHistoryChartProps {
  points: { date: string; price: number }[]
  unit: string
}

const RANGES = [
  { key: "30d", label: "30D", days: 35 },
  { key: "6m", label: "6M", days: 185 },
  { key: "2y", label: "2Y", days: 740 },
] as const

function fmtInr(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function PriceHistoryChart({ points, unit }: PriceHistoryChartProps) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("2y")
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  // single-hue blue, validated for each surface
  const lineColor = isDark ? "#3987e5" : "#2a78d6"

  const days = RANGES.find(r => r.key === range)!.days
  // anchor the range to the newest data point (pure w.r.t. props)
  const latestT = points.length ? new Date(points[points.length - 1].date).getTime() : 0
  const cutoff = latestT - days * 86400000
  const visible = points.filter(p => new Date(p.date).getTime() >= cutoff)
  const data = (visible.length >= 2 ? visible : points).map(p => ({
    label: new Date(p.date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    price: p.price,
  }))

  if (data.length < 2) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Not enough history for a chart yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        {RANGES.map(r => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
              range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 12, left: 8, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: mutedColor }} stroke={mutedColor} minTickGap={24} />
          <YAxis tickFormatter={fmtInr} tick={{ fontSize: 11, fill: textColor }} stroke={mutedColor} domain={["auto", "auto"]} width={64} />
          <Tooltip
            formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}/${unit}`, "Price"]}
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
          <Line type="monotone" dataKey="price" stroke={lineColor} strokeWidth={2} dot={{ r: 2.5, fill: lineColor }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

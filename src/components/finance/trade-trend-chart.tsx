"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { useTheme } from "next-themes"

interface TradeTrendChartProps {
  data: { month: string; sales: number; purchases: number }[]
}

// Same in/out identity colors as the Outstanding chart; pair passes the
// palette validator on both light and dark surfaces.
const SALES_COLOR = "#0891b2"
const PURCHASES_COLOR = "#d97706"

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function TradeTrendChart({ data }: TradeTrendChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb"

  if (data.every((d) => d.sales === 0 && d.purchases === 0)) {
    return (
      <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
        No sales or purchase vouchers yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: textColor }} stroke={mutedColor} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: textColor }} stroke={mutedColor} />
        <Tooltip
          formatter={(value) =>
            `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          }
          cursor={{ fill: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: "0.625rem",
            fontSize: 13,
            color: textColor,
          }}
          labelStyle={{ color: textColor }}
          itemStyle={{ color: textColor }}
        />
        <Legend wrapperStyle={{ color: textColor }} />
        <Bar dataKey="sales" name="Sales" fill={SALES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="purchases" name="Purchases" fill={PURCHASES_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  )
}

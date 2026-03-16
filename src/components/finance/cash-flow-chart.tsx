"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { useTheme } from "next-themes"

interface CashFlowChartProps {
  data: { month: string; inflow: number; outflow: number }[]
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb"

  if (data.every((d) => d.inflow === 0 && d.outflow === 0)) {
    return (
      <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
        No cash flow data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: textColor }} stroke={mutedColor} />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: textColor }} stroke={mutedColor} />
        <Tooltip
          formatter={(value) =>
            `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          }
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
        <Area
          type="monotone"
          dataKey="inflow"
          name="Money In"
          stroke="#16a34a"
          fill="#16a34a"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="outflow"
          name="Money Out"
          stroke="#dc2626"
          fill="#dc2626"
          fillOpacity={0.1}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

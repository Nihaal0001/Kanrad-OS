"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts"
import { useTheme } from "next-themes"

interface ExpenseBreakdownChartProps {
  data: { group: string; amount: number }[]
}

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function ExpenseBreakdownChart({ data }: ExpenseBreakdownChartProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // single-hue magnitude encoding — blue, stepped per surface (validated)
  const barColor = isDark ? "#3987e5" : "#2a78d6"
  const textColor = isDark ? "#ffffff" : "#3c2a1e"
  const mutedColor = isDark ? "#9ca3af" : "#6b7280"
  const gridColor = isDark ? "#374151" : "#e5e7eb"
  const tooltipBg = isDark ? "#1c1917" : "#ffffff"
  const tooltipBorder = isDark ? "#374151" : "#e5e7eb"

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground">
        No expense ledgers synced from Tally yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 64, left: 8, bottom: 5 }}
        barCategoryGap={8}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatCurrency}
          tick={{ fontSize: 12, fill: mutedColor }}
          stroke={mutedColor}
        />
        <YAxis
          type="category"
          dataKey="group"
          width={150}
          tick={{ fontSize: 12, fill: textColor }}
          stroke={mutedColor}
        />
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
        <Bar dataKey="amount" name="Amount" fill={barColor} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList
            dataKey="amount"
            position="right"
            formatter={(v) => formatCurrency(Number(v) || 0)}
            style={{ fontSize: 12, fill: textColor }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

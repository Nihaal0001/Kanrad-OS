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

interface CashFlowChartProps {
  data: { month: string; inflow: number; outflow: number }[]
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

export function CashFlowChart({ data }: CashFlowChartProps) {
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          formatter={(value: number) =>
            `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
          }
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.625rem",
            fontSize: 13,
          }}
        />
        <Legend />
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

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
import type { OutstandingBill } from "@/lib/tally/outstanding"

function bucketOf(due: string | null): "Overdue" | "Due Soon" | "Upcoming" {
  if (!due) return "Upcoming"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due)
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days < 0) return "Overdue"
  if (days <= 7) return "Due Soon"
  return "Upcoming"
}

function fmt(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(0)}K`
  return `₹${n}`
}

export function OutstandingChart({ bills }: { bills: OutstandingBill[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const axis = isDark ? "#e5e7eb" : "#1f2937"
  const muted = isDark ? "#9ca3af" : "#6b7280"
  const grid = isDark ? "#3f3f46" : "#e5e7eb"
  const cyan = isDark ? "#22d3ee" : "#0891b2"
  const amber = isDark ? "#fbbf24" : "#d97706"

  const buckets = ["Overdue", "Due Soon", "Upcoming"] as const
  const data = buckets.map((b) => ({
    bucket: b,
    incoming: bills.filter((x) => x.type === "incoming" && bucketOf(x.due_date) === b).reduce((s, x) => s + x.amount, 0),
    outgoing: bills.filter((x) => x.type === "outgoing" && bucketOf(x.due_date) === b).reduce((s, x) => s + x.amount, 0),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: axis }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 12, fill: muted }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(v, name) => [`₹${Number(v).toLocaleString("en-IN")}`, name === "incoming" ? "Incoming" : "Outgoing"]}
          contentStyle={{ background: isDark ? "#1c1917" : "#fff", border: `1px solid ${grid}`, borderRadius: 8, fontSize: 13, color: axis }}
          labelStyle={{ color: axis, fontWeight: 600 }}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
        />
        <Legend wrapperStyle={{ color: axis, fontSize: 12 }} formatter={(v) => (v === "incoming" ? "Incoming" : "Outgoing")} />
        <Bar dataKey="incoming" name="incoming" fill={cyan} radius={[4, 4, 0, 0]} />
        <Bar dataKey="outgoing" name="outgoing" fill={amber} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

"use client"

import { useState } from "react"
import { Plus, ChevronDown, ChevronUp, Info } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { CommodityHistory } from "@/actions/market-intel"
import { PriceHistoryChart } from "./price-history-chart"

interface PriceTableProps {
  history: CommodityHistory[]
  onUpdate: (commodityId: string) => void
}

function PctChip({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-xs text-muted-foreground/50">— {label}</span>
  const up = value > 0
  const flat = value === 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
        flat
          ? "border-border text-muted-foreground"
          : up
            ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
            : "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
      )}
      title={`${label} change`}
    >
      {up ? "▲" : flat ? "•" : "▼"} {Math.abs(value)}% {label}
    </span>
  )
}

function Sparkline({ points }: { points: { price: number }[] }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const stroke = isDark ? "#3987e5" : "#2a78d6"

  const recent = points.slice(-13) // ~1 year of monthly points
  if (recent.length < 2) return <span className="text-xs text-muted-foreground/40">—</span>

  const w = 72
  const h = 22
  const min = Math.min(...recent.map(p => p.price))
  const max = Math.max(...recent.map(p => p.price))
  const span = max - min || 1
  const path = recent
    .map((p, i) => {
      const x = (i / (recent.length - 1)) * w
      const y = h - ((p.price - min) / span) * (h - 3) - 1.5
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Commodities the free IMF feed covers; the rest are manual-entry. */
const AUTO_FED = /lme aluminium|lme nickel|iron ore|coking coal/i

export function PriceTable({ history, onUpdate }: PriceTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const withData = history.filter(h => h.latest !== null)
  const manualOnly = history.filter(h => h.latest === null)

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
        No commodities found. Run the database migration to set up the commodities table.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commodity</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Latest Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Trend (1y)</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Change</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">As of</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {withData.map(c => {
                const expanded = expandedId === c.id
                return (
                  <>
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        ₹{c.latest!.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/{c.unit}</span>
                      </td>
                      <td className="px-4 py-3"><Sparkline points={c.points} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <PctChip value={c.momPct} label="MoM" />
                          <PctChip value={c.yoyPct} label="YoY" />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{c.latestDate ? formatDate(c.latestDate) : "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => onUpdate(c.id)}>
                          <Plus className="h-3 w-3 mr-1" />Update
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expanded ? null : c.id)}
                          disabled={c.points.length < 2}
                        >
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${c.id}-chart`}>
                        <td colSpan={6} className="px-4 pb-4 pt-1 bg-muted/10">
                          <PriceHistoryChart points={c.points} unit={c.unit} />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {manualOnly.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            No prices yet for {manualOnly.map(c => c.name).join(", ")}.
            {manualOnly.some(c => !AUTO_FED.test(c.name)) && " These have no free market feed — log prices manually with the Log Price button."}
          </span>
        </div>
      )}
    </div>
  )
}

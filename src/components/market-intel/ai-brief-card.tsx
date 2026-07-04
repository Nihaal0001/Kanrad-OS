"use client"

import { useState, useTransition } from "react"
import { Sparkles, RefreshCcw, Loader2, CircleAlert, CalendarClock, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate, cn } from "@/lib/utils"
import { regenerateMarketBrief } from "@/actions/market-intel"
import type { MarketBrief } from "@/lib/market/brief"

const SENTIMENT_STYLES: Record<MarketBrief["sentiment"], string> = {
  positive: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  neutral: "bg-muted text-muted-foreground border-border",
  cautious: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  negative: "bg-red-500/10 text-red-600 border-red-500/20",
}

const URGENCY: Record<"now" | "this_week" | "monitor", { label: string; cls: string; icon: typeof CircleAlert }> = {
  now: { label: "Now", cls: "bg-red-500/10 text-red-600 border-red-500/20", icon: CircleAlert },
  this_week: { label: "This week", cls: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: CalendarClock },
  monitor: { label: "Monitor", cls: "bg-muted text-muted-foreground border-border", icon: Eye },
}

export function AiBriefCard({ brief: initial, isAdmin }: { brief: MarketBrief | null; isAdmin: boolean }) {
  const [brief, setBrief] = useState(initial)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleRegenerate() {
    setError("")
    startTransition(async () => {
      const res = await regenerateMarketBrief()
      if ("error" in res) {
        setError(res.error)
        return
      }
      setBrief(res.data)
    })
  }

  if (!brief && !isAdmin) return null

  // tolerate briefs stored before the action-oriented shape
  const whatChanged = brief?.what_changed ?? (brief as unknown as { bullets?: string[] })?.bullets ?? []
  const actions = brief?.actions ?? []

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Daily Market Brief
            {brief && (
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", SENTIMENT_STYLES[brief.sentiment])}>
                {brief.sentiment}
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {brief && <span className="text-xs text-muted-foreground">{formatDate(brief.brief_date)}</span>}
            {isAdmin && (
              <Button size="sm" variant="ghost" onClick={handleRegenerate} disabled={isPending} className="h-7 px-2 text-xs">
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                <span className="ml-1">{isPending ? "Generating…" : "Regenerate"}</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{error}</div>
        )}

        {!brief ? (
          <p className="text-sm text-muted-foreground">
            No brief yet — it generates automatically every morning once news and prices sync.
            {isAdmin && " Click Regenerate to create one now."}
          </p>
        ) : (
          <>
            <p className="font-semibold leading-snug">{brief.headline}</p>

            {whatChanged.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">What changed</p>
                <ul className="space-y-1.5">
                  {whatChanged.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recommended actions</p>
                <div className="space-y-2">
                  {actions.map((a, i) => {
                    const u = URGENCY[a.urgency] ?? URGENCY.monitor
                    const Icon = u.icon
                    return (
                      <div key={i} className="flex items-start gap-2.5 rounded-lg border border-border/70 bg-background/60 p-2.5">
                        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", u.cls)}>
                          <Icon className="h-3 w-3" /> {u.label}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">{a.action}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{a.reason}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {brief.price_snapshot.some(p => p.latest !== null) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                {brief.price_snapshot
                  .filter(p => p.latest !== null)
                  .map(p => (
                    <span key={p.name} className="tabular-nums" title={p.asOf ? `Benchmark monthly avg · as of ${formatDate(p.asOf)}` : undefined}>
                      {p.name}: ₹{p.latest!.toLocaleString("en-IN")}
                      {p.momPct !== null && (
                        <span className={cn("ml-1", p.momPct > 0 ? "text-amber-600" : p.momPct < 0 ? "text-cyan-700 dark:text-cyan-400" : "")}>
                          ({p.momPct > 0 ? "+" : ""}{p.momPct}% MoM)
                        </span>
                      )}
                    </span>
                  ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

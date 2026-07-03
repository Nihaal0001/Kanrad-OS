"use client"

import { useState, useTransition } from "react"
import { Sparkles, RefreshCcw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react"
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

            <ul className="space-y-1.5">
              {brief.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  {b}
                </li>
              ))}
            </ul>

            {brief.impact.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {brief.impact.map((imp, i) => {
                  const Icon = imp.direction === "up" ? TrendingUp : imp.direction === "down" ? TrendingDown : Minus
                  return (
                    <span
                      key={i}
                      title={imp.note}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                        imp.direction === "up"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
                          : imp.direction === "down"
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                            : "border-border bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {imp.subject}
                    </span>
                  )
                })}
              </div>
            )}

            {brief.price_snapshot.some(p => p.latest !== null) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                {brief.price_snapshot
                  .filter(p => p.latest !== null)
                  .map(p => (
                    <span key={p.name} className="tabular-nums">
                      {p.name}: ₹{p.latest!.toLocaleString("en-IN")}
                      {p.momPct !== null && (
                        <span className={cn("ml-1", p.momPct > 0 ? "text-amber-600" : p.momPct < 0 ? "text-cyan-700 dark:text-cyan-400" : "")}>
                          ({p.momPct > 0 ? "+" : ""}{p.momPct}%)
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

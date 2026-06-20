"use client"

import { useState, useEffect } from "react"
import { Sparkles, AlertTriangle, Lightbulb, Bell, RefreshCw, Loader2, ArrowRight } from "lucide-react"
import Link from "next/link"

import { generateInsights, refreshInsights, type Insight } from "@/actions/ai"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const VALID_HREFS = new Set([
  "/orders", "/orders/new",
  "/inventory", "/inventory/purchase-orders", "/inventory/purchase-orders/new",
  "/production", "/warehouse",
  "/tasks",
  "/finance/invoices", "/finance/invoices/new", "/finance/payments", "/finance/costing", "/finance/cash-flow",
  "/hr/attendance", "/hr/leaves", "/hr/payroll", "/hr/shifts",
  "/notifications", "/users", "/settings",
])

function isSafeHref(href: string): boolean {
  if (VALID_HREFS.has(href)) return true
  // allow dynamic routes like /orders/123
  return /^\/[a-z/-]+\/[a-zA-Z0-9-]+$/.test(href)
}

const INSIGHT_ICONS = {
  warning: AlertTriangle,
  suggestion: Lightbulb,
  alert: Bell,
}

const INSIGHT_COLORS = {
  warning: "text-amber-600",
  suggestion: "text-emerald-600",
  alert: "text-red-500",
}

const INSIGHT_BG = {
  warning: "bg-amber-500/10 border border-amber-500/20",
  suggestion: "bg-emerald-500/10 border border-emerald-500/20",
  alert: "bg-red-500/10 border border-red-500/20",
}

export function AIInsightsPanel() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Load insights once on mount. State is set inside the async callback (not
  // synchronously in the effect body); `loading` already starts true.
  useEffect(() => {
    let cancelled = false
    generateInsights().then((result) => {
      if (cancelled) return
      if ("insights" in result) setInsights(result.insights)
      else setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    setError(null)
    const result = await refreshInsights()
    if ("insights" in result) {
      setInsights(result.insights)
    } else {
      setError(result.error)
    }
    setRefreshing(false)
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-amber-500" />
          AI Insights
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="text-muted-foreground"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing your factory data…
          </div>
        )}

        {error && !loading && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            AI service temporarily unavailable. Try refreshing in a moment.
          </p>
        )}

        {!loading && !error && insights.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No patterns detected yet. Add more orders and production data to get insights.
          </p>
        )}

        {!loading && insights.length > 0 && (
          <div className="space-y-3">
            {insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb
              const color = INSIGHT_COLORS[insight.type] ?? "text-muted-foreground"
              const bg = INSIGHT_BG[insight.type] ?? "bg-muted"

              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg p-3",
                    bg
                  )}
                >
                  <div className={cn("mt-0.5 shrink-0", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="mt-0.5 text-xs text-foreground/60">
                      {insight.description}
                    </p>
                    {insight.action && isSafeHref(insight.action.href) && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0 text-xs"
                        asChild
                      >
                        <Link href={insight.action.href}>
                          {insight.action.label}
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

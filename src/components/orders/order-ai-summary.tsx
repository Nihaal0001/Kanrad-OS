"use client"

import { useState } from "react"
import { Sparkles, Loader2, AlertTriangle, Shield, ShieldAlert } from "lucide-react"

import { generateOrderSummary } from "@/actions/ai"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const RISK_CONFIG = {
  low: { icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50", label: "Low Risk" },
  medium: { icon: ShieldAlert, color: "text-amber-600", bg: "bg-amber-50", label: "Medium Risk" },
  high: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50", label: "High Risk" },
}

interface OrderAISummaryProps {
  orderId: string
}

export function OrderAISummary({ orderId }: OrderAISummaryProps) {
  const [summary, setSummary] = useState<{
    risk_level: string
    summary: string
    recommendations: string[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    const result = await generateOrderSummary(orderId)
    setLoading(false)

    if ("summary" in result) {
      setSummary(result.summary)
    } else {
      setError(result.error)
    }
  }

  if (!summary && !loading && !error) {
    return (
      <Card className="border-dashed border-amber-200/60">
        <CardContent className="flex flex-col items-center gap-2 py-6">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            className="gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Summary
          </Button>
          <p className="text-xs text-muted-foreground">
            Get risk assessment and recommendations
          </p>
        </CardContent>
      </Card>
    )
  }

  const risk = RISK_CONFIG[(summary?.risk_level as keyof typeof RISK_CONFIG)] ?? RISK_CONFIG.medium
  const RiskIcon = risk.icon

  return (
    <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50/30 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-amber-500" />
          AI Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing order…
          </div>
        )}

        {error && (
          <p className="py-2 text-sm text-muted-foreground">{error}</p>
        )}

        {summary && (
          <>
            <div className={cn("flex items-center gap-2 rounded-md px-3 py-2", risk.bg)}>
              <RiskIcon className={cn("h-4 w-4", risk.color)} />
              <span className={cn("text-sm font-medium", risk.color)}>
                {risk.label}
              </span>
            </div>

            <p className="text-sm leading-relaxed">{summary.summary}</p>

            {summary.recommendations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Recommendations
                </p>
                <ul className="space-y-1">
                  {summary.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full text-xs text-muted-foreground"
            >
              <Sparkles className="h-3 w-3" />
              Refresh Analysis
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

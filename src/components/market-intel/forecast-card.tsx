"use client"

import { useState, useTransition } from "react"
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { predictCommodityPrice, type PriceForecastResult } from "@/actions/analytics"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ForecastCardProps {
  commodities: { id: string; name: string }[]
}

export function ForecastCard({ commodities }: ForecastCardProps) {
  const [, startTransition] = useTransition()
  const [forecastCategoryId, setForecastCategoryId] = useState("")
  const [forecast, setForecast] = useState<PriceForecastResult | null>(null)
  const [forecastError, setForecastError] = useState("")
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastExpanded, setForecastExpanded] = useState(true)

  function handleForecast() {
    if (!forecastCategoryId) return
    setForecastLoading(true)
    setForecastError("")
    setForecast(null)
    startTransition(async () => {
      const res = await predictCommodityPrice(forecastCategoryId)
      setForecastLoading(false)
      if ("error" in res) { setForecastError(res.error); return }
      setForecast(res.data)
      setForecastExpanded(true)
    })
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI 10-Day Price Forecast
          </CardTitle>
          {forecast && (
            <button onClick={() => setForecastExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
              {forecastExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Uses price history + market news to predict prices for the next 10 days</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {commodities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log at least one commodity price to use AI forecasting.</p>
        ) : (
          <div className="flex gap-3">
            <Select value={forecastCategoryId} onValueChange={(v: string) => { setForecastCategoryId(v); setForecast(null); setForecastError("") }}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select a commodity to forecast..." /></SelectTrigger>
              <SelectContent>
                {commodities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleForecast} disabled={!forecastCategoryId || forecastLoading}>
              {forecastLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Forecasting…</> : <><Sparkles className="h-4 w-4 mr-2" />Forecast</>}
            </Button>
          </div>
        )}

        {forecastError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">{forecastError}</div>
        )}

        {forecast && forecastExpanded && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold">{forecast.material_name}</p>
                <p className="text-xs text-muted-foreground">
                  Last known: ₹{forecast.last_known_price}/{forecast.unit} on {formatDate(forecast.last_known_date)}
                </p>
              </div>
              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border",
                forecast.confidence === "high" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                forecast.confidence === "medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                "bg-red-500/10 text-red-600 border-red-500/20"
              )}>
                {forecast.confidence.charAt(0).toUpperCase() + forecast.confidence.slice(1)} confidence
              </span>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={[
                { label: "Today", price: forecast.last_known_price, low: forecast.last_known_price, high: forecast.last_known_price },
                ...forecast.predictions.map(p => ({
                  label: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                  price: p.predicted_price,
                  low: p.low,
                  high: p.high,
                }))
              ]} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${v}`} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, name) => [`₹${Number(v).toFixed(2)}`, name === "price" ? "Predicted" : name === "high" ? "High" : "Low"]}
                />
                <ReferenceLine x="Today" stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="high" stroke="transparent" fill="url(#rangeGrad)" />
                <Area type="monotone" dataKey="low" stroke="transparent" fill="hsl(var(--background))" />
                <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#priceGrad)" dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </AreaChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {forecast.predictions.map((p, i) => {
                const change = p.predicted_price - forecast.last_known_price
                const pct = ((change / forecast.last_known_price) * 100).toFixed(1)
                return (
                  <div key={i} className="rounded-lg border border-border bg-background p-2 text-center">
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                    <div className="font-semibold text-sm mt-0.5">₹{p.predicted_price.toFixed(2)}</div>
                    <div className={cn("text-[10px] font-medium", change >= 0 ? "text-red-500" : "text-emerald-500")}>
                      {change >= 0 ? "+" : ""}{pct}%
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">AI Reasoning</p>
              <p className="text-sm text-muted-foreground">{forecast.reasoning}</p>
              {forecast.factors.length > 0 && (
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-3">
                  {forecast.factors.map((f, i) => <li key={i} className="list-disc">{f}</li>)}
                </ul>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground">
              ⚠ AI forecasts are estimates based on historical data and news sentiment. Always verify with market sources before making purchasing decisions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

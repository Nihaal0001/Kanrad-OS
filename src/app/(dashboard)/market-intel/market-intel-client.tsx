"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, ExternalLink, IndianRupee, Newspaper, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { logCommodityPrice, createMarketNews, deleteMarketNews, predictCommodityPrice, type PriceForecastResult } from "@/actions/analytics"
import { fetchMarketNews } from "@/actions/fetch-news"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

const NEWS_CATEGORIES = [
  { value: "cookware", label: "Cookware" },
  { value: "raw_material", label: "Raw Material" },
  { value: "industry", label: "Industry" },
  { value: "regulation", label: "Regulation" },
  { value: "general", label: "General" },
]

const CATEGORY_COLORS: Record<string, string> = {
  cookware: "bg-orange-500/15 text-orange-600 border-orange-500/20",
  raw_material: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  industry: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  regulation: "bg-purple-500/15 text-purple-600 border-purple-500/20",
  general: "bg-muted text-muted-foreground",
}

const COMMON_UNITS = ["kg", "MT", "tonne", "piece", "litre", "sq ft", "metre", "roll"]

type Commodity = {
  id: string
  name: string
  latest_price: { price: number; unit: string; date: string; supplier: string | null } | null
}
type News = { id: string; title: string; summary: string | null; url: string | null; category: string; source: string | null; published_at: string }
type Supplier = { id: string; name: string }

export function MarketIntelClient({ commodities, news, suppliers }: {
  commodities: Commodity[]
  news: News[]
  suppliers: Supplier[]
}) {
  const [tab, setTab] = useState<"prices" | "news" | "schedule">("prices")
  const [isPending, startTransition] = useTransition()
  const [fetchingNews, setFetchingNews] = useState(false)
  const [fetchResult, setFetchResult] = useState("")

  function handleFetchNews() {
    setFetchingNews(true)
    setFetchResult("")
    startTransition(async () => {
      const res = await fetchMarketNews()
      setFetchingNews(false)
      setFetchResult(res.error ? `Error: ${res.error}` : `✓ ${res.inserted} new articles added`)
    })
  }

  // AI price forecast
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

  // Price log form
  const emptyPriceForm = { category_id: "", price_per_unit: "", unit: "kg", supplier_id: "", recorded_at: new Date().toISOString().split("T")[0], notes: "" }
  const [priceForm, setPriceForm] = useState(emptyPriceForm)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceError, setPriceError] = useState("")

  // News form
  const [newsForm, setNewsForm] = useState({ title: "", summary: "", url: "", category: "general", source: "", published_at: new Date().toISOString().split("T")[0] })
  const [newsOpen, setNewsOpen] = useState(false)
  const [newsError, setNewsError] = useState("")

  function openLogPrice(categoryId = "") {
    setPriceForm({ ...emptyPriceForm, category_id: categoryId })
    setPriceError("")
    setPriceOpen(true)
  }

  function handleLogPrice() {
    if (!priceForm.category_id || !priceForm.price_per_unit) { setPriceError("Commodity and price are required"); return }
    setPriceError("")
    startTransition(async () => {
      const res = await logCommodityPrice({
        category_id: priceForm.category_id,
        price_per_unit: parseFloat(priceForm.price_per_unit),
        unit: priceForm.unit,
        supplier_id: priceForm.supplier_id || undefined,
        recorded_at: priceForm.recorded_at,
        notes: priceForm.notes || undefined,
      })
      if (res && "error" in res) { setPriceError(res.error ?? "Unknown error"); return }
      setPriceOpen(false)
      setPriceForm(emptyPriceForm)
    })
  }

  function handleAddNews() {
    if (!newsForm.title) { setNewsError("Title is required"); return }
    setNewsError("")
    startTransition(async () => {
      const res = await createMarketNews({
        title: newsForm.title,
        summary: newsForm.summary || undefined,
        url: newsForm.url || undefined,
        category: newsForm.category,
        source: newsForm.source || undefined,
        published_at: newsForm.published_at,
      })
      if (res && "error" in res) { setNewsError(res.error ?? "Unknown error"); return }
      setNewsOpen(false)
      setNewsForm({ title: "", summary: "", url: "", category: "general", source: "", published_at: new Date().toISOString().split("T")[0] })
    })
  }

  function handleDeleteNews(id: string) {
    startTransition(async () => { await deleteMarketNews(id) })
  }

  const commoditiesWithPrice = commodities.filter(c => c.latest_price)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Intel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track commodity prices and industry news</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tab === "news" && (
            <Button variant="outline" onClick={handleFetchNews} disabled={fetchingNews || isPending}>
              {fetchingNews ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Newspaper className="h-4 w-4 mr-2" />}
              {fetchingNews ? "Fetching…" : "Fetch Latest News"}
            </Button>
          )}
          {tab !== "news" && (
            <Button onClick={() => openLogPrice()}>
              <Plus className="h-4 w-4 mr-2" />
              Log Price
            </Button>
          )}
          {tab === "news" && (
            <Button onClick={() => setNewsOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add News
            </Button>
          )}
        </div>
      </div>

      {fetchResult && (
        <div className={cn("text-sm px-4 py-2 rounded-lg border", fetchResult.startsWith("Error") ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400")}>
          {fetchResult}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["prices", "schedule", "news"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "prices" ? "Commodity Prices" : t === "schedule" ? "Price Schedule" : "Industry News"}
          </button>
        ))}
      </div>

      {/* Prices Tab */}
      {tab === "prices" && (
        <div className="space-y-4">
          {commoditiesWithPrice.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commodity</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Latest Price</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commoditiesWithPrice.map(c => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₹{c.latest_price!.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/{c.latest_price!.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.latest_price!.supplier ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(c.latest_price!.date)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openLogPrice(c.id)}>
                          <Plus className="h-3 w-3 mr-1" />Update
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {commodities.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              No material categories found. Add categories in Item Master first.
            </div>
          )}

          {commodities.length > 0 && commoditiesWithPrice.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No prices logged yet. Click <strong>Log Price</strong> to start tracking commodity prices.
            </div>
          )}

          {/* AI Price Forecast */}
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
              {commoditiesWithPrice.length === 0 ? (
                <p className="text-sm text-muted-foreground">Log at least one commodity price to use AI forecasting.</p>
              ) : (
                <div className="flex gap-3">
                  <Select value={forecastCategoryId} onValueChange={(v: string) => { setForecastCategoryId(v); setForecast(null); setForecastError("") }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select a commodity to forecast..." /></SelectTrigger>
                    <SelectContent>
                      {commoditiesWithPrice.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleForecast} disabled={!forecastCategoryId || forecastLoading || isPending}>
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
        </div>
      )}

      {/* Schedule Tab */}
      {tab === "schedule" && (
        <ScheduleTab commodities={commodities} onLogPrice={openLogPrice} />
      )}

      {/* News Tab */}
      {tab === "news" && (
        <div className="space-y-4">
          {news.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              No news yet. News auto-fetches daily, or click "Add News" to add manually.
            </div>
          )}

          {news.filter(n => n.category === "cookware").length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-orange-600">🍳 Cookware Industry</span>
                <div className="flex-1 h-px bg-orange-500/20" />
              </div>
              {news.filter(n => n.category === "cookware").map(item => (
                <NewsCard key={item.id} item={item} onDelete={handleDeleteNews} isPending={isPending} highlight />
              ))}
            </div>
          )}

          {news.filter(n => n.category !== "cookware").length > 0 && (
            <div className="space-y-2">
              {news.filter(n => n.category === "cookware").length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other News</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              {news.filter(n => n.category !== "cookware").map(item => (
                <NewsCard key={item.id} item={item} onDelete={handleDeleteNews} isPending={isPending} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log Price Modal */}
      {priceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPriceOpen(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Log Commodity Price</h2>
            </div>
            {priceError && <p className="text-sm text-destructive">{priceError}</p>}
            <div className="space-y-3">
              <div>
                <Label>Commodity *</Label>
                <Select value={priceForm.category_id} onValueChange={v => setPriceForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select commodity..." /></SelectTrigger>
                  <SelectContent>
                    {commodities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Price per unit (₹) *</Label>
                  <Input type="number" step="0.01" className="mt-1" value={priceForm.price_per_unit}
                    onChange={e => setPriceForm(f => ({ ...f, price_per_unit: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Select value={priceForm.unit} onValueChange={v => setPriceForm(f => ({ ...f, unit: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMMON_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" className="mt-1" value={priceForm.recorded_at}
                  onChange={e => setPriceForm(f => ({ ...f, recorded_at: e.target.value }))} />
              </div>
              <div>
                <Label>Supplier (optional)</Label>
                <Select value={priceForm.supplier_id} onValueChange={(v: string) => setPriceForm(f => ({ ...f, supplier_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input className="mt-1" value={priceForm.notes}
                  onChange={e => setPriceForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. spot rate, quoted by supplier..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setPriceOpen(false)}>Cancel</Button>
              <Button onClick={handleLogPrice} disabled={isPending}>Log Price</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add News Modal */}
      {newsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setNewsOpen(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Add News Item</h2>
            </div>
            {newsError && <p className="text-sm text-destructive">{newsError}</p>}
            <div className="space-y-3">
              <div>
                <Label>Title *</Label>
                <Input className="mt-1" value={newsForm.title}
                  onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))} placeholder="News headline..." />
              </div>
              <div>
                <Label>Summary</Label>
                <Input className="mt-1" value={newsForm.summary}
                  onChange={e => setNewsForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={newsForm.category} onValueChange={(v: string) => setNewsForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NEWS_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" className="mt-1" value={newsForm.published_at}
                    onChange={e => setNewsForm(f => ({ ...f, published_at: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Source</Label>
                <Input className="mt-1" value={newsForm.source}
                  onChange={e => setNewsForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. Economic Times..." />
              </div>
              <div>
                <Label>URL (optional)</Label>
                <Input className="mt-1" value={newsForm.url}
                  onChange={e => setNewsForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setNewsOpen(false)}>Cancel</Button>
              <Button onClick={handleAddNews} disabled={isPending}>Add News</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const FREQUENCIES = [
  { value: "7", label: "Weekly" },
  { value: "14", label: "Fortnightly" },
  { value: "30", label: "Monthly" },
  { value: "60", label: "Every 2 months" },
  { value: "0", label: "No schedule" },
]

const STORAGE_KEY = "commodity-price-schedules"

function loadSchedules(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") } catch { return {} }
}

function saveSchedules(s: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

function ScheduleTab({ commodities, onLogPrice }: {
  commodities: Commodity[]
  onLogPrice: (categoryId: string) => void
}) {
  const [schedules, setSchedules] = useState<Record<string, number>>(() => loadSchedules())
  const today = new Date()

  function setFrequency(categoryId: string, days: number) {
    setSchedules(prev => {
      const next = { ...prev, [categoryId]: days }
      saveSchedules(next)
      return next
    })
  }

  const rows = commodities.map(c => {
    const lastDate = c.latest_price?.date ? new Date(c.latest_price.date) : null
    const daysSince = lastDate ? Math.floor((today.getTime() - lastDate.getTime()) / 86400000) : null
    const freq = schedules[c.id] ?? 0
    const nextDue = (freq > 0 && lastDate)
      ? new Date(lastDate.getTime() + freq * 86400000)
      : null
    const daysUntilDue = nextDue ? Math.ceil((nextDue.getTime() - today.getTime()) / 86400000) : null
    const isOverdue = daysUntilDue !== null && daysUntilDue <= 0
    const isDueSoon = daysUntilDue !== null && daysUntilDue > 0 && daysUntilDue <= 2
    return { ...c, daysSince, lastDate, freq, nextDue, daysUntilDue, isOverdue, isDueSoon }
  }).sort((a, b) => {
    // Overdue first, then due soon, then no schedule, then upcoming
    if (a.isOverdue && !b.isOverdue) return -1
    if (!a.isOverdue && b.isOverdue) return 1
    if (a.isDueSoon && !b.isDueSoon) return -1
    if (!a.isDueSoon && b.isDueSoon) return 1
    if (a.freq > 0 && b.freq === 0) return -1
    if (a.freq === 0 && b.freq > 0) return 1
    if (a.daysUntilDue !== null && b.daysUntilDue !== null) return a.daysUntilDue - b.daysUntilDue
    return a.name.localeCompare(b.name)
  })

  const overdueCount = rows.filter(r => r.isOverdue).length
  const dueSoonCount = rows.filter(r => r.isDueSoon).length
  const scheduledCount = rows.filter(r => r.freq > 0).length

  function dueLabel(row: typeof rows[0]) {
    if (row.freq === 0) return { text: "No schedule", color: "text-muted-foreground" }
    if (row.lastDate === null) return { text: "Log first price to start schedule", color: "text-muted-foreground" }
    if (row.isOverdue) return { text: `Overdue by ${Math.abs(row.daysUntilDue!)}d`, color: "text-red-600" }
    if (row.isDueSoon) return { text: `Due in ${row.daysUntilDue}d`, color: "text-amber-600" }
    return { text: `Due ${row.nextDue!.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`, color: "text-muted-foreground" }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-2xl font-bold">{scheduledCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Scheduled</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Overdue</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="text-2xl font-bold text-amber-600">{dueSoonCount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Due within 2 days</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <span className="text-sm font-medium text-muted-foreground">Set how often to check each commodity price</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Commodity</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Price</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Check Frequency</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Next Due</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(c => {
              const { text, color } = dueLabel(c)
              return (
                <tr key={c.id} className={cn("transition-colors", c.isOverdue ? "bg-red-500/5 hover:bg-red-500/8" : "hover:bg-muted/20")}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.daysSince !== null && (
                      <div className="text-xs text-muted-foreground">Last logged {c.daysSince}d ago</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.latest_price ? (
                      <span className="font-medium">
                        ₹{c.latest_price.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/{c.latest_price.unit}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-44">
                    <Select
                      value={String(c.freq)}
                      onValueChange={v => setFrequency(c.id, Number(v))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium", color)}>{text}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant={c.isOverdue ? "default" : "outline"} onClick={() => onLogPrice(c.id)}>
                      <Plus className="h-3 w-3 mr-1" />Log Price
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NewsCard({ item, onDelete, isPending, highlight }: {
  item: News
  onDelete: (id: string) => void
  isPending: boolean
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      highlight ? "border-orange-500/30 bg-orange-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general)}>
              {NEWS_CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(item.published_at)}</span>
            {item.source && <span className="text-xs text-muted-foreground">· {item.source}</span>}
          </div>
          <h3 className={cn("font-semibold leading-snug", highlight && "text-orange-900 dark:text-orange-100")}>{item.title}</h3>
          {item.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5">
              Read more <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <button
          className="shrink-0 text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
          onClick={() => onDelete(item.id)} disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

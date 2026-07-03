"use client"

import { useState, useTransition } from "react"
import { Plus, IndianRupee, Newspaper, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { logCommodityPrice, createMarketNews, deleteMarketNews } from "@/actions/analytics"
import { fetchMarketNews } from "@/actions/fetch-news"
import { cn } from "@/lib/utils"
import type { CommodityHistory, BomCostImpact, TopStory } from "@/actions/market-intel"
import type { MarketBrief } from "@/lib/market/brief"
import { AiBriefCard } from "@/components/market-intel/ai-brief-card"
import { PriceTable } from "@/components/market-intel/price-table"
import { BomImpactCard } from "@/components/market-intel/bom-impact-card"
import { ForecastCard } from "@/components/market-intel/forecast-card"
import { NewsSection, NEWS_CATEGORIES, type News } from "@/components/market-intel/news-section"

const COMMON_UNITS = ["kg", "MT", "tonne", "piece", "litre", "sq ft", "metre", "roll"]

type Commodity = {
  id: string
  name: string
  defaultUnit: string
  latest_price: { price: number; unit: string; date: string; supplier: string | null } | null
}
type Supplier = { id: string; name: string }

export function MarketIntelClient({ commodities, history, impact, brief, topStories, news, suppliers, isAdmin }: {
  commodities: Commodity[]
  history: CommodityHistory[]
  impact: BomCostImpact
  brief: MarketBrief | null
  topStories: TopStory[]
  news: News[]
  suppliers: Supplier[]
  isAdmin: boolean
}) {
  const [tab, setTab] = useState<"prices" | "news">("prices")
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

  // Price log form
  const emptyPriceForm = { commodity_id: "", price_per_unit: "", unit: "MT", supplier_id: "", recorded_at: new Date().toISOString().split("T")[0], notes: "" }
  const [priceForm, setPriceForm] = useState(emptyPriceForm)
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceError, setPriceError] = useState("")

  // News form
  const [newsForm, setNewsForm] = useState({ title: "", summary: "", url: "", category: "general", source: "", published_at: new Date().toISOString().split("T")[0] })
  const [newsOpen, setNewsOpen] = useState(false)
  const [newsError, setNewsError] = useState("")

  function openLogPrice(commodityId = "") {
    const defaultUnit = commodities.find(c => c.id === commodityId)?.defaultUnit ?? "MT"
    setPriceForm({ ...emptyPriceForm, commodity_id: commodityId, unit: defaultUnit })
    setPriceError("")
    setPriceOpen(true)
  }

  function handleLogPrice() {
    if (!priceForm.commodity_id || !priceForm.price_per_unit) { setPriceError("Commodity and price are required"); return }
    setPriceError("")
    startTransition(async () => {
      const res = await logCommodityPrice({
        commodity_id: priceForm.commodity_id,
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

  const forecastable = commodities.filter(c => c.latest_price).map(c => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Intel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live commodity prices, cost impact on your products, and curated industry news</p>
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

      {/* AI Daily Brief — always visible above the tabs */}
      <AiBriefCard brief={brief} isAdmin={isAdmin} />

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["prices", "news"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "prices" ? "Commodity Prices" : "Industry News"}
          </button>
        ))}
      </div>

      {tab === "prices" && (
        <div className="space-y-4">
          <PriceTable history={history} onUpdate={openLogPrice} />
          <BomImpactCard impact={impact} />
          <ForecastCard commodities={forecastable} />
        </div>
      )}

      {tab === "news" && (
        <NewsSection news={news} topStories={topStories} onDelete={handleDeleteNews} isPending={isPending} />
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
                <Select value={priceForm.commodity_id} onValueChange={v => setPriceForm(f => ({ ...f, commodity_id: v }))}>
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

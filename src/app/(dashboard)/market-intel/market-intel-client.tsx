"use client"

import { useState, useTransition } from "react"
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, ExternalLink, IndianRupee, Newspaper } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { logMaterialPrice, createMarketNews, deleteMarketNews } from "@/actions/analytics"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

const NEWS_CATEGORIES = [
  { value: "raw_material", label: "Raw Material" },
  { value: "industry", label: "Industry" },
  { value: "regulation", label: "Regulation" },
  { value: "general", label: "General" },
]

const CATEGORY_COLORS: Record<string, string> = {
  raw_material: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  industry: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  regulation: "bg-purple-500/15 text-purple-600 border-purple-500/20",
  general: "bg-muted text-muted-foreground",
}

type Material = {
  id: string; name: string; sku: string; unit: string
  category: { name: string } | null
  latest_price: { price: number; date: string; supplier: string | null } | null
}
type News = { id: string; title: string; summary: string | null; url: string | null; category: string; source: string | null; published_at: string }
type Supplier = { id: string; name: string }

export function MarketIntelClient({ materials, news, suppliers }: {
  materials: Material[]
  news: News[]
  suppliers: Supplier[]
}) {
  const [tab, setTab] = useState<"prices" | "news">("prices")
  const [isPending, startTransition] = useTransition()

  // Price log form
  const [priceForm, setPriceForm] = useState({ material_id: "", price_per_unit: "", supplier_id: "", recorded_at: new Date().toISOString().split("T")[0], notes: "" })
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceError, setPriceError] = useState("")

  // News form
  const [newsForm, setNewsForm] = useState({ title: "", summary: "", url: "", category: "general", source: "", published_at: new Date().toISOString().split("T")[0] })
  const [newsOpen, setNewsOpen] = useState(false)
  const [newsError, setNewsError] = useState("")

  function handleLogPrice() {
    if (!priceForm.material_id || !priceForm.price_per_unit) { setPriceError("Material and price are required"); return }
    setPriceError("")
    startTransition(async () => {
      const res = await logMaterialPrice({
        material_id: priceForm.material_id,
        price_per_unit: parseFloat(priceForm.price_per_unit),
        supplier_id: priceForm.supplier_id || undefined,
        recorded_at: priceForm.recorded_at,
        notes: priceForm.notes || undefined,
      })
      if (res && "error" in res) { setPriceError(res.error ?? "Unknown error"); return }
      setPriceOpen(false)
      setPriceForm({ material_id: "", price_per_unit: "", supplier_id: "", recorded_at: new Date().toISOString().split("T")[0], notes: "" })
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

  const materialsWithPrice = materials.filter(m => m.latest_price)
  const materialsWithoutPrice = materials.filter(m => !m.latest_price)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Market Intel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Track raw material prices and industry news</p>
        </div>
        <Button onClick={() => tab === "prices" ? setPriceOpen(true) : setNewsOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {tab === "prices" ? "Log Price" : "Add News"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["prices", "news"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-md px-4 py-1.5 text-sm font-medium transition-all capitalize",
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "prices" ? "Raw Material Prices" : "Industry News"}
          </button>
        ))}
      </div>

      {/* Prices Tab */}
      {tab === "prices" && (
        <div className="space-y-4">
          {materialsWithPrice.length > 0 && (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Material</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Latest Price</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {materialsWithPrice.map(m => (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        ₹{m.latest_price!.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/{m.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.latest_price!.supplier ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(m.latest_price!.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {materialsWithoutPrice.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{materialsWithoutPrice.length}</span> materials have no price logged yet.
              Use "Log Price" to start tracking.
            </div>
          )}

          {materials.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              No materials found. Add materials in Item Master first.
            </div>
          )}
        </div>
      )}

      {/* News Tab */}
      {tab === "news" && (
        <div className="space-y-3">
          {news.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
              No news yet. Click "Add News" to add industry updates.
            </div>
          )}
          {news.map(item => (
            <Card key={item.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border capitalize", CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.general)}>
                        {NEWS_CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(item.published_at)}</span>
                      {item.source && <span className="text-xs text-muted-foreground">· {item.source}</span>}
                    </div>
                    <h3 className="font-semibold leading-snug">{item.title}</h3>
                    {item.summary && <p className="text-sm text-muted-foreground mt-1">{item.summary}</p>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5">
                        Read more <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteNews(item.id)} disabled={isPending}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Log Price Modal */}
      {priceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPriceOpen(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Log Material Price</h2>
            </div>
            {priceError && <p className="text-sm text-destructive">{priceError}</p>}
            <div className="space-y-3">
              <div>
                <Label>Material *</Label>
                <Select value={priceForm.material_id} onValueChange={v => setPriceForm(f => ({ ...f, material_id: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select material..." /></SelectTrigger>
                  <SelectContent>
                    {materials.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.sku})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price per unit (₹) *</Label>
                  <Input type="number" step="0.01" className="mt-1" value={priceForm.price_per_unit}
                    onChange={e => setPriceForm(f => ({ ...f, price_per_unit: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input type="date" className="mt-1" value={priceForm.recorded_at}
                    onChange={e => setPriceForm(f => ({ ...f, recorded_at: e.target.value }))} />
                </div>
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
                  onChange={e => setPriceForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. market rate, spot price..." />
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

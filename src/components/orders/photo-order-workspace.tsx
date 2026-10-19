"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, Check, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createOrderFromPhoto, discardOrderPhoto } from "@/actions/order-photo"
import type { LineMatch } from "@/lib/order-photo-match"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerSelect } from "@/components/orders/customer-select"
import { ProductSelect } from "@/components/orders/product-select"

interface Props {
  customers: Array<{ id: string; name: string; company: string | null }>
}

interface CatalogProduct { id: string; name: string; sku: string; materialCost: number }

interface ExtractResponse {
  photoPath: string
  photoHash: string
  duplicate: { orderId: string; orderNumber: string } | null
  customerId: string | null
  customerHint: string
  deadline: string
  warnings: string[]
  lines: Array<{
    key: string
    code: string
    writtenName: string
    quantity: number | null
    confidence: number
    note: string
    match: LineMatch
  }>
  products: CatalogProduct[]
}

interface Line {
  key: string
  code: string
  writtenName: string
  quantity: string
  productName: string
  matchStatus: LineMatch["status"]
  candidates: LineMatch["candidates"]
  confidence: number
  note: string
  confirmed: boolean
}

const LOW_CONFIDENCE = 0.7
const MAX_EDGE = 2000

/** Shrink phone photos in the browser so the upload stays well under the 4 MB request limit. */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q))
    if (blob && blob.size <= 3.5 * 1024 * 1024) return blob
  }
  throw new Error("Photo is too large even after shrinking — try a closer, cleaner shot.")
}

function needsReview(l: { match: LineMatch; quantity: number | null; confidence: number; note: string }) {
  return l.match.status !== "matched" || l.quantity === null || l.confidence < LOW_CONFIDENCE || !!l.note
}

export function PhotoOrderWorkspace({ customers }: Props) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState<"reading" | "saving" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [customerId, setCustomerId] = useState("")
  const [deadline, setDeadline] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [duplicateNote, setDuplicateNote] = useState<string | null>(null)
  const [allowDuplicate, setAllowDuplicate] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const products = useMemo(() => result?.products ?? [], [result])
  const byName = useMemo(() => new Map(products.map((p) => [p.name, p])), [products])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy("reading")
    try {
      const blob = await shrinkImage(file)
      const form = new FormData()
      form.append("photo", new File([blob], "order-sheet.jpg", { type: "image/jpeg" }))
      const res = await fetch("/api/order-photo/extract", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error ?? (res.status === 504 ? "Reading the sheet timed out — please try again." : "Could not read the sheet"))
      }
      const data = json as ExtractResponse

      setPreviewUrl(URL.createObjectURL(blob))
      setResult(data)
      setCustomerId(data.customerId ?? "")
      setDeadline(data.deadline)
      setDuplicateNote(data.duplicate ? `This exact photo was already used for ${data.duplicate.orderNumber}.` : null)
      setAllowDuplicate(false)
      setLines(
        data.lines.map((l) => ({
          key: l.key,
          code: l.code,
          writtenName: l.writtenName,
          quantity: l.quantity === null ? "" : String(l.quantity),
          productName: l.match.productId ? data.products.find((p) => p.id === l.match.productId)?.name ?? "" : "",
          matchStatus: l.match.status,
          candidates: l.match.candidates,
          confidence: l.confidence,
          note: l.note,
          confirmed: !needsReview(l),
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the sheet")
    } finally {
      setBusy(null)
      if (cameraRef.current) cameraRef.current.value = ""
      if (galleryRef.current) galleryRef.current.value = ""
    }
  }

  function patch(key: string, change: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)))
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: `m${Date.now()}`, code: "", writtenName: "", quantity: "", productName: "", matchStatus: "unmatched", candidates: [], confidence: 1, note: "", confirmed: false },
    ])
  }

  async function startOver() {
    if (result) void discardOrderPhoto(result.photoPath)
    setResult(null); setLines([]); setPreviewUrl(null); setError(null); setDuplicateNote(null)
  }

  const lineProblem = (l: Line) => {
    const q = Number(l.quantity)
    if (!l.productName || !byName.has(l.productName)) return "Pick a product"
    if (!Number.isInteger(q) || q < 1) return "Enter a quantity"
    if (!l.confirmed) return "Tick to confirm"
    return null
  }
  const problems = lines.filter((l) => lineProblem(l)).length
  const duplicateBlocked = !!duplicateNote && !allowDuplicate
  const canSave = !!result && !!customerId && !!deadline && lines.length > 0 && problems === 0 && !duplicateBlocked && busy === null

  async function save() {
    if (!result) return
    setBusy("saving")
    setError(null)
    try {
      const res = await createOrderFromPhoto({
        customer_id: customerId,
        deadline,
        photoPath: result.photoPath,
        photoHash: result.photoHash,
        allowDuplicate,
        items: lines.map((l) => ({
          product_name: l.productName,
          quantity: Number(l.quantity),
          unit_price: Math.round((byName.get(l.productName)?.materialCost ?? 0) * 100) / 100,
        })),
      })
      if ("duplicate" in res && res.duplicate) { setDuplicateNote(res.duplicate); setAllowDuplicate(false); return }
      if ("error" in res && res.error) { setError(res.error); toast.error(res.error); return }
      if ("warning" in res && res.warning) toast.warning(res.warning)
      toast.success(`Draft order ${res.data!.orderNumber} created`)
      router.push(`/orders/${res.data!.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg); toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  // ---------- Upload stage ----------
  if (!result) {
    return (
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Upload the order sheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <p className="text-sm text-muted-foreground">
            Use the standard order sheet. Lay it flat, fill the frame, and make sure the Product Code and Quantity columns are sharp.
            Nothing is saved until you confirm the extracted lines.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" disabled={busy !== null} onClick={() => cameraRef.current?.click()}>
              {busy === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              Take photo
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Choose from gallery
            </Button>
            <Button type="button" variant="ghost" asChild>
              <a href="/api/order-sheet/pdf" download>Download blank order sheet</a>
            </Button>
          </div>
          {busy === "reading" && <p className="text-sm text-muted-foreground">Reading the sheet… this can take up to a minute.</p>}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </CardContent>
      </Card>
    )
  }

  // ---------- Review stage ----------
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader><CardTitle>Original photo</CardTitle></CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previewUrl && <img src={previewUrl} alt="Handwritten order sheet" className="max-h-[75vh] w-full rounded-md border object-contain" />}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {duplicateNote && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-2">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Possible duplicate: {duplicateNote}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} />
              This is a genuinely separate order — create it anyway
            </label>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium">The reader flagged:</p>
            <ul className="list-disc pl-5">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        <Card>
          <CardHeader><CardTitle>Order details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer{result.customerHint && !customerId ? <span className="ml-2 text-xs text-muted-foreground">sheet says “{result.customerHint}”</span> : null}</Label>
              <CustomerSelect value={customerId} onChange={setCustomerId} customers={customers} placeholder="Select a customer" addLabel="Manage Customers" addHref="/customers" />
            </div>
            <div className="space-y-2">
              <Label>Deadline</Label>
              <DatePicker value={deadline} onChange={setDeadline} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lines ({lines.length})</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4" /> Add line</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">No lines were read. Add them manually or start over with a clearer photo.</p>}
            {lines.map((l, idx) => {
              const problem = lineProblem(l)
              const flagged = l.matchStatus !== "matched" || l.confidence < LOW_CONFIDENCE || !!l.note || l.quantity === ""
              return (
                <div key={l.key} className={`space-y-3 rounded-lg border p-3 ${problem ? "border-amber-500/60" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">#{idx + 1}</span> Written:{" "}
                      <span className="font-mono">{[l.code, l.writtenName].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                    <div className="space-y-1.5">
                      <Label>Product</Label>
                      <ProductSelect
                        value={l.productName}
                        onChange={(name) => patch(l.key, { productName: name, confirmed: false })}
                        products={products}
                        placeholder="Select product…"
                      />
                      {!l.productName && l.candidates.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-xs text-muted-foreground">Did you mean:</span>
                          {l.candidates.slice(0, 3).map((c) => (
                            <button key={c.id} type="button" className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => patch(l.key, { productName: c.name, confirmed: false })}>
                              {c.name} <span className="font-mono text-muted-foreground">{c.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Qty (pcs)</Label>
                      <Input type="number" min={1} value={l.quantity} placeholder="?" onChange={(e) => patch(l.key, { quantity: e.target.value, confirmed: false })} />
                    </div>
                  </div>

                  {(
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-amber-600 dark:text-amber-400">
                        {[
                          l.matchStatus === "unmatched" && !l.productName ? "No confident product match" : null,
                          l.matchStatus === "suggested" ? "Best guess — check the product" : null,
                          l.quantity === "" ? "Quantity unreadable" : null,
                          l.confidence < LOW_CONFIDENCE ? "Handwriting unclear" : null,
                          l.note || null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={l.confirmed} onChange={(e) => patch(l.key, { confirmed: e.target.checked })} />
                        {l.confirmed ? <Check className="h-3 w-3" /> : null} I’ve checked this line
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {problems > 0 ? `${problems} line${problems === 1 ? "" : "s"} still need attention.` : "Saved as a draft — add costing before confirming."}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={startOver}>Start over</Button>
            <Button type="button" disabled={!canSave} onClick={save}>
              {busy === "saving" ? "Saving…" : "Create draft order"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Camera, ImagePlus, Loader2, PackagePlus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { confirmScannedBill } from "@/actions/bill-scan"
import type { LineMatch } from "@/lib/order-photo-match"
import { circleWeightFor } from "@/lib/costing"
import { formatCurrency } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CustomerSelect } from "@/components/orders/customer-select"
import { ProductSelect } from "@/components/orders/product-select"

type Direction = "purchase" | "sales"

interface Props {
  customers: Array<{ id: string; name: string; company: string | null }>
}

interface MaterialOption {
  id: string
  sku: string
  name: string
  unit: string
  currentStock: number
  cost: number
  pieceWeightKg: number | null
  circleType: "ib" | "non_ib" | null
}

interface ExtractResponse {
  direction: Direction | "unknown"
  sellerName: string
  sellerGst: string
  sellerAddress: string
  sellerContact: string
  buyerName: string
  buyerGst: string
  buyerAddress: string
  placeOfSupply: string
  reverseCharge: boolean
  printedDueDate: string
  poReference: string
  notes: string
  categories: Array<{ id: string; name: string }>
  invoiceNumber: string
  invoiceDate: string
  taxRate: number | null
  isIgst: boolean
  totalAmount: number | null
  warnings: string[]
  duplicate: { id: string; label: string } | null
  customerId: string | null
  lines: Array<{
    key: string
    code: string
    name: string
    hsn: string
    quantity: number | null
    unit: string
    unit_price: number | null
    confidence: number
    note: string
    match: LineMatch
  }>
  materials: MaterialOption[]
}

interface Line {
  key: string
  code: string
  writtenName: string
  hsn: string
  billUnit: string
  /** Quantity and rate exactly as printed — kept so a kg → pcs conversion is always recomputed from the bill */
  billQty: number | null
  billRate: number | null
  quantity: string
  rate: string
  materialLabel: string
  createNew: boolean
  newSku: string
  newName: string
  newUnit: string
  newCategory: string
  newMinStock: string
  newLocation: string
  /** Circle type answered by the user — a bill cannot tell IB from non-IB */
  circleKind: "" | "ib" | "non_ib"
  matchStatus: LineMatch["status"]
  matchMethod: LineMatch["method"]
  candidates: LineMatch["candidates"]
  confidence: number
  note: string
  converted: string
  confirmed: boolean
}

const LOW_CONFIDENCE = 0.7
const MAX_EDGE = 2000
/** "272X2.4" → { dia: 272, thick: 2.4 } */
function circleSize(text: string) {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i)
  return m ? { dia: Number(m[1]), thick: Number(m[2]) } : null
}
const isKg = (u: string) => /^kgs?$|kilo/i.test(u.trim())

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

export function ScanBillWorkspace({ customers }: Props) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState<"reading" | "saving" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [direction, setDirection] = useState<Direction | "">("")
  const [partyName, setPartyName] = useState("")
  const [partyGst, setPartyGst] = useState("")
  const [partyAddress, setPartyAddress] = useState("")
  const [placeOfSupply, setPlaceOfSupply] = useState("")
  const [reverseCharge, setReverseCharge] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState("")
  const [taxRate, setTaxRate] = useState("")
  const [isIgst, setIsIgst] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [duplicateNote, setDuplicateNote] = useState<string | null>(null)
  const [askOpen, setAskOpen] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const materials = useMemo(() => result?.materials ?? [], [result])
  // Dropdown labels must be unique, or two materials with the same name could be mixed up
  const options = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of materials) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
    return materials.map((m) => ({ id: m.id, sku: m.sku, name: (counts.get(m.name) ?? 0) > 1 ? `${m.name} (${m.sku})` : m.name }))
  }, [materials])
  const byLabel = useMemo(() => new Map(options.map((o, i) => [o.name, materials[i]])), [options, materials])

  /** A circle if the material is one, or a new material named like 272X2.4 */
  function circleInfo(l: Pick<Line, "createNew" | "newName" | "materialLabel" | "circleKind">) {
    const m = byLabel.get(l.materialLabel)
    const isCircle = l.createNew ? !!circleSize(l.newName) : !!m && (m.pieceWeightKg !== null || m.circleType !== null)
    const kind = (!l.createNew && m?.circleType) || l.circleKind
    const fixed = !l.createNew && !!m?.circleType
    const weight = l.createNew ? circleWeightFor({ name: l.newName, cost_per_unit: 0 }) : m?.pieceWeightKg ?? null
    return { isCircle, kind, fixed, weight }
  }

  /**
   * Qty/rate for a line. Circles are stocked in pcs:
   *  - non-IB billed in kg → pcs and price per piece from the calculated weight
   *  - IB billed in kg → cannot be converted (no weight kept), so the user enters pcs and price per piece
   *  - circle with no type answered yet and billed in kg → left blank until answered
   */
  function priced(l: Pick<Line, "billQty" | "billRate" | "billUnit">, c: { isCircle: boolean; kind: string; weight: number | null }) {
    if (c.isCircle && isKg(l.billUnit)) {
      if (c.kind === "non_ib" && c.weight && l.billQty && l.billRate !== null) {
        const pcs = Math.round(l.billQty / c.weight)
        const unitPrice = Math.round(l.billRate * c.weight * 100) / 100
        return { quantity: String(pcs), rate: String(unitPrice), converted: `${l.billQty} kg @ ${formatCurrency(l.billRate)}/kg → ${pcs} pcs (${c.weight.toFixed(3)} kg each)` }
      }
      return { quantity: "", rate: "", converted: "" }
    }
    return { quantity: l.billQty === null ? "" : String(l.billQty), rate: l.billRate === null ? "" : String(l.billRate), converted: "" }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy("reading")
    try {
      const blob = await shrinkImage(file)
      const form = new FormData()
      form.append("photo", new File([blob], "bill.jpg", { type: "image/jpeg" }))
      const res = await fetch("/api/bill-scan/extract", { method: "POST", body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? (res.status === 504 ? "Reading the bill timed out — please try again." : "Could not read the bill"))
      const data = json as ExtractResponse

      setPreviewUrl(URL.createObjectURL(blob))
      setResult(data)
      setDirection(data.direction === "unknown" ? "" : data.direction)
      setPartyName(data.direction === "sales" ? data.buyerName : data.sellerName)
      setPartyGst(data.direction === "sales" ? data.buyerGst : data.sellerGst)
      setPartyAddress(data.direction === "sales" ? data.buyerAddress : data.sellerAddress)
      setPlaceOfSupply(data.placeOfSupply)
      setReverseCharge(data.reverseCharge)
      setDueDate(data.printedDueDate)
      setNotes([data.poReference ? `PO ref: ${data.poReference}` : "", data.notes].filter(Boolean).join("\n"))
      setCustomerId(data.customerId ?? "")
      setInvoiceNumber(data.invoiceNumber)
      setInvoiceDate(data.invoiceDate)
      setTaxRate(data.taxRate === null ? "" : String(data.taxRate))
      setIsIgst(data.isIgst)
      setAllowDuplicate(false)
      setDuplicateNote(data.duplicate ? `Bill ${data.duplicate.label} is already in the system.` : null)
      setLines(
        data.lines.map((l) => {
          const m = data.materials.find((x) => x.id === l.match.productId)
          const p = priced({ billQty: l.quantity, billRate: l.unit_price, billUnit: l.unit }, { isCircle: !!m && (m.pieceWeightKg !== null || m.circleType !== null), kind: m?.circleType ?? "", weight: m?.pieceWeightKg ?? null })
          const dup = data.materials.filter((x) => x.name === m?.name).length > 1
          return {
            key: l.key, code: l.code, writtenName: l.name, hsn: l.hsn, billUnit: l.unit,
            billQty: l.quantity, billRate: l.unit_price,
            quantity: p.quantity, rate: p.rate, converted: p.converted,
            materialLabel: m ? (dup ? `${m.name} (${m.sku})` : m.name) : "",
            createNew: false, newSku: l.code, newName: l.name, newUnit: l.unit && !isKg(l.unit) ? l.unit.toLowerCase() : "pcs",
            newCategory: "", newMinStock: "", newLocation: "", circleKind: "",
            matchStatus: l.match.status, matchMethod: l.match.method, candidates: l.match.candidates,
            confidence: l.confidence, note: l.note,
            // Only an exact code hit is trusted without a tick; a name match is shown so it can be confirmed
            confirmed: l.match.status === "matched" && l.match.method === "code" && l.confidence >= LOW_CONFIDENCE && !l.note,
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read the bill")
    } finally {
      setBusy(null)
      if (cameraRef.current) cameraRef.current.value = ""
      if (galleryRef.current) galleryRef.current.value = ""
    }
  }

  function patch(key: string, change: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)))
  }

  function pickMaterial(l: Line, label: string) {
    const next = { ...l, materialLabel: label, createNew: false }
    patch(l.key, { materialLabel: label, createNew: false, confirmed: false, ...priced(l, circleInfo(next)) })
  }

  function addLine() {
    setLines((prev) => [...prev, {
      key: `m${Date.now()}`, code: "", writtenName: "", hsn: "", billUnit: "", billQty: null, billRate: null, quantity: "", rate: "", converted: "",
      materialLabel: "", createNew: false, newSku: "", newName: "", newUnit: "pcs", newCategory: "", newMinStock: "", newLocation: "", circleKind: "", matchStatus: "unmatched", matchMethod: null, candidates: [],
      confidence: 1, note: "", confirmed: false,
    }])
  }

  function startOver() {
    setResult(null); setLines([]); setPreviewUrl(null); setError(null); setDuplicateNote(null); setDirection("")
  }

  const lineProblem = (l: Line) => {
    if (direction === "purchase") {
      if (l.createNew) {
        if (!l.newSku.trim() || !l.newName.trim()) return "Enter a code and name for the new material"
      } else if (!l.materialLabel || !byLabel.has(l.materialLabel)) return "Pick a material or create a new one"
      if (circleInfo(l).isCircle && !circleInfo(l).kind) return "Choose IB or non-IB for this circle"
    } else if (!l.writtenName.trim() && !l.newName.trim()) return "Add a description"
    if (!(Number(l.quantity) > 0)) return "Enter a quantity"
    if (l.rate === "" || !(Number(l.rate) >= 0)) return "Enter a rate"
    if (!l.confirmed) return "Tick to confirm"
    return null
  }
  const problems = lines.filter((l) => lineProblem(l)).length
  const duplicateBlocked = !!duplicateNote && !allowDuplicate
  const tax = Number(taxRate) || 0
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0)
  const computedTotal = Math.round(subtotal * (1 + tax / 100) * 100) / 100
  const totalMismatch = result?.totalAmount != null && Math.abs(result.totalAmount - computedTotal) > Math.max(2, computedTotal * 0.005)
  const partyOk = direction === "sales" ? !!partyName.trim() : !!partyName.trim() && !!invoiceNumber.trim()
  const canReview = !!result && !!direction && partyOk && !!invoiceDate && taxRate !== "" && lines.length > 0 && problems === 0 && !duplicateBlocked && busy === null

  async function save() {
    if (!direction) return
    setBusy("saving")
    setError(null)
    try {
      const res = await confirmScannedBill({
        direction,
        party_name: partyName.trim(),
        party_gst: partyGst.trim(),
        party_address: direction === "sales" ? partyAddress.trim() : "",
        place_of_supply: placeOfSupply.trim(),
        reverse_charge: direction === "sales" ? reverseCharge : false,
        due_date: direction === "sales" ? dueDate : "",
        notes: notes.trim(),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        tax_rate: tax,
        is_igst: isIgst,
        customer_id: direction === "sales" ? customerId : "",
        allowDuplicate,
        lines: lines.map((l) => {
          const m = byLabel.get(l.materialLabel)
          const create = direction === "purchase" && l.createNew
          return {
            description: create ? l.newName.trim() : m?.name ?? (l.writtenName.trim() || l.newName.trim()),
            hsn: l.hsn,
            quantity: Number(l.quantity),
            unit_price: Number(l.rate),
            material_id: direction === "purchase" && !create ? m?.id : undefined,
            set_circle_type: direction === "purchase" && !create && m && !m.circleType && l.circleKind ? l.circleKind : undefined,
            new_material: create
              ? {
                  sku: l.newSku.trim(), name: l.newName.trim(), unit: l.newUnit.trim() || "pcs",
                  category_id: l.newCategory || undefined,
                  min_stock_level: l.newMinStock === "" ? undefined : Number(l.newMinStock),
                  location: l.newLocation.trim() || undefined,
                  supplier_contact: result?.sellerContact || undefined,
                  circle: circleSize(l.newName) && l.circleKind
                    ? { diameter_mm: circleSize(l.newName)!.dia, thickness_mm: circleSize(l.newName)!.thick, circle_type: l.circleKind }
                    : undefined,
                }
              : undefined,
          }
        }),
      })
      if ("duplicate" in res && res.duplicate) { setDuplicateNote(res.duplicate); setAllowDuplicate(false); setAskOpen(false); return }
      if ("error" in res && res.error) { setError(res.error); toast.error(res.error); setAskOpen(false); return }
      const d = res.data!
      toast.success(d.kind === "purchase" ? `Bill ${d.label} added — ${d.stockLines} item${d.stockLines === 1 ? "" : "s"} stocked, payable created` : `Invoice ${d.label} added to receivables`)
      router.push(d.kind === "purchase" ? "/finance/payables" : "/finance/invoices")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg); toast.error(msg); setAskOpen(false)
    } finally {
      setBusy(null)
    }
  }

  // ---------- Upload stage ----------
  if (!result) {
    return (
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Upload the bill</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <p className="text-sm text-muted-foreground">
            Works for supplier bills (adds stock and a payable) and bills we issue (adds a receivable). Lay the bill flat, fill the frame,
            and keep the item table sharp. Nothing is saved until you review and say yes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" disabled={busy !== null} onClick={() => cameraRef.current?.click()}>
              {busy === "reading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Take photo
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Choose from gallery
            </Button>
          </div>
          {busy === "reading" && <p className="text-sm text-muted-foreground">Reading the bill… this can take up to a minute.</p>}
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
          <CardHeader><CardTitle>Original bill</CardTitle></CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previewUrl && <img src={previewUrl} alt="Scanned bill" className="max-h-[75vh] w-full rounded-md border object-contain" />}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {duplicateNote && (
          <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Possible duplicate: {duplicateNote}</p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} />
              This is a different bill — add it anyway
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
          <CardHeader><CardTitle>Where does this bill go?</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["purchase", "Purchase bill", "From a supplier. Adds stock to Inventory and a payable to Finance."],
                ["sales", "Sales bill", "Issued by us. Adds a receivable to Finance; stock is not changed."],
              ] as const).map(([value, title, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDirection(value)
                    setPartyName(value === "sales" ? result.buyerName : result.sellerName)
                    setPartyGst(value === "sales" ? result.buyerGst : result.sellerGst)
                    setPartyAddress(value === "sales" ? result.buyerAddress : result.sellerAddress)
                    setCustomerId(value === "sales" ? result.customerId ?? "" : "")
                  }}
                  className={`rounded-lg border p-3 text-left text-sm ${direction === value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
                >
                  <span className="block font-medium">{title}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
            {!direction && <p className="text-sm text-amber-600 dark:text-amber-400">Could not tell which side is us — choose one.</p>}

            {direction && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{direction === "purchase" ? "Supplier" : "Customer"}</Label>
                  <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} />
                </div>
                {direction === "sales" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Link to a saved customer <span className="text-xs text-muted-foreground">(optional)</span></Label>
                    <CustomerSelect value={customerId} onChange={setCustomerId} customers={customers} placeholder="Select a customer" addLabel="Manage Customers" addHref="/customers" />
                  </div>
                )}
                <div className="space-y-1.5"><Label>GSTIN</Label><Input value={partyGst} onChange={(e) => setPartyGst(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Bill number{direction === "purchase" ? " *" : ""}</Label>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-1.5"><Label>Bill date</Label><DatePicker value={invoiceDate} onChange={setInvoiceDate} /></div>
                <div className="space-y-1.5">
                  <Label>GST %</Label>
                  <Input type="number" min={0} max={100} value={taxRate} placeholder="?" onChange={(e) => setTaxRate(e.target.value)} />
                </div>
                {direction === "sales" && (
                  <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input value={partyAddress} onChange={(e) => setPartyAddress(e.target.value)} /></div>
                )}
                <div className="space-y-1.5"><Label>Place of supply</Label><Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} /></div>
                {direction === "sales" ? (
                  <div className="space-y-1.5"><Label>Due date <span className="text-xs text-muted-foreground">(optional)</span></Label><DatePicker value={dueDate} onChange={setDueDate} /></div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Payment due</Label>
                    <p className="pt-2 text-sm text-muted-foreground">
                      45 days from today (entry date){result.printedDueDate ? ` · bill prints ${result.printedDueDate}` : ""}
                    </p>
                  </div>
                )}
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={isIgst} onChange={(e) => setIsIgst(e.target.checked)} /> IGST (inter-state)</label>
                  {direction === "sales" && (
                    <label className="flex items-center gap-2"><input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} /> Reverse charge applies</label>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items ({lines.length})</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4" /> Add line</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {lines.map((l, idx) => {
              const problem = direction ? lineProblem(l) : null
              const flags = [
                direction === "purchase" && !l.createNew && !l.materialLabel ? "No code or name match" : null,
                l.matchMethod === "name" || (l.matchMethod === "fuzzy" && !!l.materialLabel) ? "Matched by name — confirm the code is right" : null,
                l.matchMethod === "code" && l.matchStatus === "suggested" ? "Code matched but the name differs" : null,
                l.confidence < LOW_CONFIDENCE ? "Print unclear" : null,
                l.note || null,
              ].filter(Boolean)
              const picked = byLabel.get(l.materialLabel)
              return (
                <div key={l.key} className={`space-y-3 rounded-lg border p-3 ${problem ? "border-amber-500/60" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">#{idx + 1}</span> On bill:{" "}
                      <span className="font-mono">{[l.code, l.writtenName].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {direction === "purchase" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Material</Label>
                        <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => patch(l.key, { createNew: !l.createNew, confirmed: false })}>
                          <PackagePlus className="h-3 w-3" /> {l.createNew ? "Pick existing instead" : "Create new material"}
                        </button>
                      </div>
                      {l.createNew ? (
                        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_6rem]">
                          <Input placeholder="Code" value={l.newSku} onChange={(e) => patch(l.key, { newSku: e.target.value, confirmed: false })} />
                          <Input placeholder="Name" value={l.newName} onChange={(e) => patch(l.key, { newName: e.target.value, confirmed: false })} />
                          <Input placeholder="Unit" value={l.newUnit} onChange={(e) => patch(l.key, { newUnit: e.target.value, confirmed: false })} />
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-sm sm:col-span-1"
                            value={l.newCategory}
                            onChange={(e) => patch(l.key, { newCategory: e.target.value, confirmed: false })}
                          >
                            <option value="">Category…</option>
                            {result.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <Input type="number" min={0} placeholder="Min stock" value={l.newMinStock} onChange={(e) => patch(l.key, { newMinStock: e.target.value, confirmed: false })} />
                          <Input placeholder="Storage location" value={l.newLocation} onChange={(e) => patch(l.key, { newLocation: e.target.value, confirmed: false })} />
                        </div>
                      ) : (
                        <ProductSelect value={l.materialLabel} onChange={(label) => pickMaterial(l, label)} products={options} placeholder="Select material…" />
                      )}
                      {!l.createNew && !l.materialLabel && l.candidates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-xs text-muted-foreground">Did you mean:</span>
                          {l.candidates.slice(0, 3).map((c) => {
                            const label = options.find((o) => o.id === c.id)?.name ?? c.name
                            return (
                              <button key={c.id} type="button" className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted" onClick={() => pickMaterial(l, label)}>
                                {c.name} <span className="font-mono text-muted-foreground">{c.sku}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {direction === "purchase" && (() => {
                        const c = circleInfo(l)
                        if (!c.isCircle) return null
                        return (
                          <div className="space-y-2 rounded-md border border-dashed p-2.5">
                            {c.fixed ? (
                              <p className="text-xs"><b>{c.kind === "ib" ? "IB" : "Non-IB"} circle</b> (from the item master)</p>
                            ) : (
                              <>
                                <p className="text-xs font-medium">Is this circle IB or non-IB?</p>
                                <div className="flex gap-2">
                                  {([["non_ib", "Non-IB"], ["ib", "IB"]] as const).map(([k, label]) => (
                                    <button
                                      key={k}
                                      type="button"
                                      className={`rounded-md border px-3 py-1 text-xs ${l.circleKind === k ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                                      onClick={() => {
                                        const next = { ...l, circleKind: k }
                                        patch(l.key, { circleKind: k, confirmed: false, ...priced(l, circleInfo(next)) })
                                      }}
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            {c.kind === "non_ib" && <p className="text-xs text-muted-foreground">Weight is calculated from the size{c.weight ? ` (${c.weight.toFixed(3)} kg each)` : ""}; stock is kept in pieces.</p>}
                            {c.kind === "ib" && (
                              <p className="text-xs text-muted-foreground">
                                IB circles carry no weight — stock and price are per piece.
                                {isKg(l.billUnit) ? ` This bill is in kg${l.billQty ? ` (${l.billQty} kg${l.billRate !== null ? ` @ ${formatCurrency(l.billRate)}/kg` : ""})` : ""}, so enter the number of pieces and the price per piece below.` : ""}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                      {picked && (
                        <p className="text-xs text-muted-foreground">
                          Code <span className="font-mono">{picked.sku}</span> · in stock {picked.currentStock} {picked.unit}
                          {l.code && l.code.toLowerCase() !== picked.sku.toLowerCase() ? ` · bill code “${l.code}” differs` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  {direction === "sales" && (
                    <div className="space-y-1.5">
                      <Label>Description</Label>
                      <Input value={l.writtenName || l.newName} onChange={(e) => patch(l.key, { writtenName: e.target.value, newName: e.target.value, confirmed: false })} />
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Qty{picked ? ` (${picked.unit})` : l.createNew ? ` (${l.newUnit || "pcs"})` : ""}</Label>
                      <Input type="number" min={0} step="any" value={l.quantity} placeholder="?" onChange={(e) => patch(l.key, { quantity: e.target.value, confirmed: false })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Rate (before tax)</Label>
                      <Input type="number" min={0} step="any" value={l.rate} placeholder="?" onChange={(e) => patch(l.key, { rate: e.target.value, confirmed: false })} />
                    </div>
                  </div>
                  {l.converted && <p className="text-xs text-muted-foreground">Converted: {l.converted}</p>}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-amber-600 dark:text-amber-400">{flags.join(" · ")}</span>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={l.confirmed} onChange={(e) => patch(l.key, { confirmed: e.target.checked })} /> I’ve checked this line
                    </label>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-1 rounded-lg border p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">GST {tax}%</span><span>{formatCurrency(computedTotal - subtotal)}</span></div>
          <div className="flex justify-between font-medium"><span>Total</span><span>{formatCurrency(computedTotal)}</span></div>
          {result.totalAmount != null && (
            <p className={totalMismatch ? "pt-1 text-amber-600 dark:text-amber-400" : "pt-1 text-xs text-muted-foreground"}>
              {totalMismatch ? "⚠ " : ""}Total printed on the bill: {formatCurrency(result.totalAmount)}{totalMismatch ? " — does not match the lines above, check quantities and rates." : " — matches."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {!direction ? "Choose where this bill goes." : problems > 0 ? `${problems} line${problems === 1 ? "" : "s"} still need attention.` : "You will be asked to confirm before anything is saved."}
          </p>
          <div className="flex gap-3">
            <Button type="button" variant="outline" disabled={busy !== null} onClick={startOver}>Start over</Button>
            <Button type="button" disabled={!canReview} onClick={() => setAskOpen(true)}>Review &amp; add</Button>
          </div>
        </div>
      </div>

      <Dialog open={askOpen} onOpenChange={(o) => { if (busy === null) setAskOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add this bill?</DialogTitle>
            <DialogDescription>
              {direction === "purchase"
                ? `Bill ${invoiceNumber} from ${partyName} · ${formatCurrency(computedTotal)}`
                : `Bill ${invoiceNumber || "(no number)"} to ${partyName} · ${formatCurrency(computedTotal)}`}
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {direction === "purchase" ? (
              <>
                <li>Adds <b>{lines.length}</b> stock entr{lines.length === 1 ? "y" : "ies"} to Inventory and updates the average cost.</li>
                {lines.some((l) => l.createNew) && <li>Creates <b>{lines.filter((l) => l.createNew).length}</b> new material{lines.filter((l) => l.createNew).length === 1 ? "" : "s"}.</li>}
                <li>Adds a payable of <b>{formatCurrency(computedTotal)}</b> to Finance, due 45 days from today.</li>
              </>
            ) : (
              <>
                <li>Adds a receivable of <b>{formatCurrency(computedTotal)}</b> to Finance.</li>
                <li>Inventory is not changed.</li>
              </>
            )}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setAskOpen(false)}>No</Button>
            <Button type="button" disabled={busy !== null} onClick={save}>{busy === "saving" ? "Adding…" : "Yes, add it"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { addStockEntry } from "@/actions/bill-scan"
import { formatCurrency } from "@/lib/utils"
import { matchProduct } from "@/lib/order-photo-match"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProductSelect } from "@/components/orders/product-select"

interface Material {
  id: string; sku: string; name: string; unit: string; currentStock: number; cost: number
  supplierName: string
  circleType: "ib" | "non_ib" | null; isCircle: boolean; pieceWeightKg: number | null
}

interface Props {
  materials: Material[]
  categories: Array<{ id: string; name: string }>
  suppliers: Array<{ id: string; name: string; gstin: string; state: string }>
}

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm"
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

/** "272X2.4" → size */
function circleSize(text: string) {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)$/i)
  return m ? { dia: Number(m[1]), thick: Number(m[2]) } : null
}

export function AddStockForm({ materials, categories, suppliers }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Item
  const [createNew, setCreateNew] = useState(false)
  const [materialLabel, setMaterialLabel] = useState("")
  const [newSku, setNewSku] = useState("")
  const [newName, setNewName] = useState("")
  const [newUnit, setNewUnit] = useState("pcs")
  const [newCategory, setNewCategory] = useState("")
  const [newMinStock, setNewMinStock] = useState("")
  const [newLocation, setNewLocation] = useState("")
  const [circleKind, setCircleKind] = useState<"" | "ib" | "non_ib">("")
  const [quantity, setQuantity] = useState("")
  const [rate, setRate] = useState("")
  const [hsn, setHsn] = useState("")
  // Bill
  const [supplierId, setSupplierId] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [supplierGst, setSupplierGst] = useState("")
  const [placeOfSupply, setPlaceOfSupply] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [taxRate, setTaxRate] = useState("18")
  const [isIgst, setIsIgst] = useState(false)
  const [notes, setNotes] = useState("")
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [duplicateNote, setDuplicateNote] = useState<string | null>(null)

  const options = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of materials) counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
    return materials.map((m) => ({ id: m.id, sku: m.sku, name: (counts.get(m.name) ?? 0) > 1 ? `${m.name} (${m.sku})` : m.name }))
  }, [materials])
  const byLabel = useMemo(() => new Map(options.map((o, i) => [o.name, materials[i]])), [options, materials])
  const picked = createNew ? undefined : byLabel.get(materialLabel)

  /** Existing material → take unit, cost and supplier from the item master */
  function pickMaterial(label: string) {
    setMaterialLabel(label)
    setCircleKind("")
    const m = byLabel.get(label)
    if (!m) return
    if (m.cost > 0) setRate(String(m.cost))
    if (m.supplierName && !supplierName.trim()) {
      const saved = suppliers.find((s) => s.name.toLowerCase() === m.supplierName.toLowerCase())
      if (saved) pickSupplier(saved.id)
      else setSupplierName(m.supplierName)
    }
  }

  // A typed code or name that is already in the item master: use that material instead of creating a duplicate
  const existingMatch = useMemo(() => {
    if (!createNew) return null
    const sku = newSku.trim().toLowerCase()
    const name = newName.trim().toLowerCase()
    if (!sku && !name) return null
    return materials.find((m) => (sku && m.sku.toLowerCase() === sku) || (name && m.name.toLowerCase() === name)) ?? null
  }, [createNew, newSku, newName, materials])

  // Not identical but close ("Carton Box 12" vs "Carton Box 12 inch"): ask, never decide
  const newKey = `${newSku.trim().toLowerCase()}|${newName.trim().toLowerCase()}`
  const [distinctKey, setDistinctKey] = useState("")
  const similar = useMemo(() => {
    if (!createNew || existingMatch || (!newSku.trim() && !newName.trim())) return []
    return matchProduct({ code: newSku, name: newName }, materials.map((m) => ({ id: m.id, name: m.name, sku: m.sku })))
      .candidates.filter((c) => c.score >= 0.5 && c.score < 1).slice(0, 3)
  }, [createNew, existingMatch, newSku, newName, materials])
  const similarOpen = similar.length > 0 && distinctKey !== newKey

  function pickExisting(m: Material) {
    setCreateNew(false)
    pickMaterial(options.find((o) => o.id === m.id)?.name ?? m.name)
  }

  const isCircle = createNew ? !!circleSize(newName) : !!picked?.isCircle
  const kindFixed = !createNew && !!picked?.circleType
  const kind = kindFixed ? picked!.circleType! : circleKind
  const unit = createNew ? newUnit || "pcs" : picked?.unit ?? ""

  const qty = Number(quantity)
  const price = Number(rate)
  const tax = Number(taxRate) || 0
  const subtotal = (qty || 0) * (price || 0)
  const total = Math.round(subtotal * (1 + tax / 100) * 100) / 100

  const problem =
    (createNew ? (existingMatch ? "This material already exists — use it instead of creating a new one" : !newSku.trim() || !newName.trim() ? "Enter a code and name for the new material" : similarOpen ? "Answer the question about the similar material" : null) : !picked ? "Pick a material" : null) ??
    (isCircle && !kind ? "Choose IB or non-IB for this circle" : null) ??
    (!(qty > 0) ? "Enter a quantity" : null) ??
    (rate === "" || !(price >= 0) ? "Enter a rate" : null) ??
    (!supplierName.trim() ? "Enter the supplier" : null) ??
    (!invoiceNumber.trim() ? "Enter the supplier's bill number" : null) ??
    (!invoiceDate ? "Enter the bill date" : null) ??
    (taxRate === "" ? "Enter the GST %" : null) ??
    (!!duplicateNote && !allowDuplicate ? "Confirm this is a different bill" : null)

  function pickSupplier(id: string) {
    setSupplierId(id)
    const s = suppliers.find((x) => x.id === id)
    if (s) { setSupplierName(s.name); setSupplierGst(s.gstin); setPlaceOfSupply(s.state) }
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const size = createNew ? circleSize(newName) : null
      const res = await addStockEntry({
        direction: "purchase",
        party_name: supplierName.trim(),
        party_gst: supplierGst.trim(),
        place_of_supply: placeOfSupply.trim(),
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        tax_rate: tax,
        is_igst: isIgst,
        notes: notes.trim(),
        allowDuplicate,
        lines: [{
          description: createNew ? newName.trim() : picked!.name,
          hsn: hsn.trim(),
          quantity: qty,
          unit_price: price,
          material_id: createNew ? undefined : picked!.id,
          set_circle_type: !createNew && picked && !picked.circleType && circleKind ? circleKind : undefined,
          new_material: createNew
            ? {
                sku: newSku.trim(), name: newName.trim(), unit: newUnit.trim() || "pcs",
                category_id: newCategory || undefined,
                min_stock_level: newMinStock === "" ? undefined : Number(newMinStock),
                location: newLocation.trim() || undefined,
                circle: size && circleKind ? { diameter_mm: size.dia, thickness_mm: size.thick, circle_type: circleKind } : undefined,
              }
            : undefined,
        }],
      })
      if ("duplicate" in res && res.duplicate) { setDuplicateNote(res.duplicate); setAllowDuplicate(false); setAskOpen(false); return }
      if (!("data" in res) || !res.data) {
        const msg = "error" in res && res.error ? res.error : "Could not add the stock"
        setError(msg); toast.error(msg); setAskOpen(false); return
      }
      toast.success(`Stock added and bill ${res.data.label} created in Payables`)
      router.push("/inventory")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg); toast.error(msg); setAskOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive lg:col-span-2">{error}</div>}
      {duplicateNote && (
        <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm lg:col-span-2">
          <p>Possible duplicate: {duplicateNote}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} /> This is a different bill — add it anyway
          </label>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Item</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Material</Label>
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setCreateNew(!createNew); setCircleKind("") }}>
                {createNew ? "Pick existing instead" : "Create new material"}
              </button>
            </div>
            {createNew ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Code (SKU) *" value={newSku} onChange={(e) => setNewSku(e.target.value)} />
                <Input placeholder="Name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Input placeholder="Unit (pcs, kg, m…)" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
                <select className={selectClass} value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  <option value="">Category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input type="number" min={0} placeholder="Minimum stock" value={newMinStock} onChange={(e) => setNewMinStock(e.target.value)} />
                <Input placeholder="Storage location" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
              </div>
            ) : (
              <ProductSelect value={materialLabel} onChange={pickMaterial} products={options} placeholder="Select material…" />
            )}
            {existingMatch && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                <span><b>{existingMatch.name}</b> (<span className="font-mono">{existingMatch.sku}</span>) already exists in the item master.</span>
                <Button type="button" size="sm" onClick={() => pickExisting(existingMatch)}>Use it</Button>
              </div>
            )}
            {similarOpen && (
              <div className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                <p className="font-medium">Similar material already exists — is it the same item?</p>
                {similar.map((c) => {
                  const m = materials.find((x) => x.id === c.id)
                  return m ? (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span><b>{m.name}</b> (<span className="font-mono">{m.sku}</span>) · in stock {m.currentStock} {m.unit}</span>
                      <Button type="button" size="sm" onClick={() => pickExisting(m)}>Yes, same item</Button>
                    </div>
                  ) : null
                })}
                <Button type="button" size="sm" variant="outline" onClick={() => setDistinctKey(newKey)}>No, this is a new material</Button>
              </div>
            )}
            {picked && (
              <p className="text-xs text-muted-foreground">
                Code <span className="font-mono">{picked.sku}</span> · in stock {picked.currentStock} {picked.unit} · average cost {formatCurrency(picked.cost)}
              </p>
            )}
          </div>

          {isCircle && (
            <div className="space-y-2 rounded-md border border-dashed p-2.5">
              {kindFixed ? (
                <p className="text-xs"><b>{kind === "ib" ? "IB" : "Non-IB"} circle</b> (from the item master)</p>
              ) : (
                <>
                  <p className="text-xs font-medium">Is this circle IB or non-IB?</p>
                  <div className="flex gap-2">
                    {([["non_ib", "Non-IB"], ["ib", "IB"]] as const).map(([k, label]) => (
                      <button key={k} type="button" className={`rounded-md border px-3 py-1 text-xs ${circleKind === k ? "border-primary bg-primary/10" : "hover:bg-muted"}`} onClick={() => setCircleKind(k)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Circles are stocked in pieces — enter the number of pieces and the price per piece.
                {kind === "ib" ? " IB circles carry no weight." : kind === "non_ib" ? " Weight is calculated from the size." : ""}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Quantity{unit ? ` (${unit})` : ""}</Label>
              <Input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate (before tax)</Label>
              <Input type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>HSN</Label>
              <Input value={hsn} onChange={(e) => setHsn(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Supplier bill (goes to Payables)</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Supplier</Label>
            <select className={selectClass} value={supplierId} onChange={(e) => pickSupplier(e.target.value)}>
              <option value="">Pick a saved supplier…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input placeholder="…or type the supplier name" value={supplierName} onChange={(e) => { setSupplierName(e.target.value); setSupplierId("") }} />
          </div>
          <div className="space-y-1.5"><Label>GSTIN</Label><Input value={supplierGst} onChange={(e) => setSupplierGst(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Place of supply</Label><Input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Supplier bill number *</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Bill date</Label><DatePicker value={invoiceDate} onChange={setInvoiceDate} /></div>
          <div className="space-y-1.5"><Label>GST %</Label><Input type="number" min={0} max={100} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={isIgst} onChange={(e) => setIsIgst(e.target.checked)} /> IGST (inter-state)</label>
          <div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Payment is due 45 days from today (entry date).</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Subtotal {formatCurrency(subtotal)} + GST {tax}% = </span>
          <b>{formatCurrency(total)}</b>
          {problem && <p className="text-xs text-amber-600 dark:text-amber-400">{problem}</p>}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.push("/inventory")}>Cancel</Button>
          <Button type="button" disabled={!!problem || busy} onClick={() => setAskOpen(true)}>Review &amp; add</Button>
        </div>
      </div>

      <Dialog open={askOpen} onOpenChange={(o) => { if (!busy) setAskOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add this stock?</DialogTitle>
            <DialogDescription>Bill {invoiceNumber} from {supplierName} · {formatCurrency(total)}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {createNew && <li>Creates the new material <b>{newName}</b> ({newSku}).</li>}
            <li>Adds <b>{quantity} {unit}</b> of <b>{createNew ? newName : picked?.name}</b> to Inventory at {formatCurrency(price)} each and updates its average cost.</li>
            <li>Adds a payable of <b>{formatCurrency(total)}</b> to Finance, due 45 days from today.</li>
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setAskOpen(false)}>No</Button>
            <Button type="button" disabled={busy} onClick={save}>{busy ? "Adding…" : "Yes, add it"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

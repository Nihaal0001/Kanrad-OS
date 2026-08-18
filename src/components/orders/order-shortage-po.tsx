"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Lock } from "lucide-react"
import { toast } from "sonner"

import { createPurchaseOrder } from "@/actions/inventory"
import { formatCurrency, friendlyError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export interface ShortageMaterial {
  id: string
  name: string
  sku: string
  unit: string
  shortage: number
  cost_per_unit: number
}

export interface SupplierOption {
  id: string
  name: string
  company: string | null
}

interface OrderShortagePOProps {
  orderId: string
  shortages: ShortageMaterial[]
  suppliers: SupplierOption[]
}

// Buying a bit extra to cover wastage/rounding is fine — capped at 10% over the shortfall.
const MAX_OVER_ORDER_PCT = 10

interface RowState {
  supplierId: string
  orderDate: string
  expectedDate: string
  price: number
  quantity: number
  taxRate: string
  referenceNo: string
  dispatchedThrough: string
  destination: string
  modeOfPayment: string
  otherReferences: string
  termsOfDelivery: string
  submitting: boolean
  done: boolean
}

function initialRow(s: ShortageMaterial): RowState {
  return {
    supplierId: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    price: s.cost_per_unit,
    quantity: s.shortage,
    taxRate: "",
    referenceNo: "",
    dispatchedThrough: "",
    destination: "",
    modeOfPayment: "",
    otherReferences: "",
    termsOfDelivery: "",
    submitting: false,
    done: false,
  }
}

export function OrderShortagePO({ orderId, shortages, suppliers }: OrderShortagePOProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Record<string, RowState>>(
    Object.fromEntries(shortages.map((s) => [s.id, initialRow(s)]))
  )

  if (shortages.length === 0) return null

  function updateRow(id: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }))
  }

  async function handleOrder(s: ShortageMaterial) {
    const row = rows[s.id]
    if (!row.supplierId) {
      toast.error("Select a supplier")
      return
    }
    if (row.taxRate.trim() === "") {
      toast.error("Enter the tax % for this purchase order")
      return
    }
    updateRow(s.id, { submitting: true })
    const result = await createPurchaseOrder({
      supplier_id: row.supplierId,
      order_date: row.orderDate,
      expected_date: row.expectedDate,
      tax_rate: Number(row.taxRate) || 0,
      notes: `Raised for material shortage on this order`,
      reference_no: row.referenceNo.trim(),
      dispatched_through: row.dispatchedThrough.trim(),
      destination: row.destination.trim(),
      mode_of_payment: row.modeOfPayment.trim(),
      other_references: row.otherReferences.trim(),
      terms_of_delivery: row.termsOfDelivery.trim(),
      order_ids: [orderId],
      items: [
        {
          material_id: s.id,
          quantity_ordered: row.quantity,
          unit_price: row.price,
        },
      ],
    })

    if ("error" in result && result.error) {
      updateRow(s.id, { submitting: false })
      toast.error(friendlyError(result.error))
      return
    }
    toast.success(`Purchase order raised for ${s.name}`)
    updateRow(s.id, { submitting: false, done: true })
    router.refresh()
  }

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Material Shortage
        </CardTitle>
        <CardDescription>
          These materials fall short of what this order&apos;s BOM needs. Each can be raised as
          its own purchase order with its own supplier — you can order up to {MAX_OVER_ORDER_PCT}%
          more than the shortfall. Prices and quantity are editable now; once a purchase order is
          raised, nothing on it can be changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {shortages.map((s) => {
          const row = rows[s.id]
          const maxQty = Math.round(s.shortage * (1 + MAX_OVER_ORDER_PCT / 100) * 1000) / 1000
          const qtyInvalid = row.quantity <= 0 || row.quantity > maxQty
          const amount = row.price * row.quantity

          return (
            <div
              key={s.id}
              className="rounded-lg border p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.sku}</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Short by {s.shortage} {s.unit}
                  </p>
                </div>
                {row.done && (
                  <span className="text-xs font-medium text-emerald-600 shrink-0">
                    Purchase order raised
                  </span>
                )}
              </div>

              {!row.done && (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Supplier *</Label>
                      <Select
                        value={row.supplierId}
                        onValueChange={(v) => updateRow(s.id, { supplierId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((sup) => (
                            <SelectItem key={sup.id} value={sup.id}>
                              {sup.name}{sup.company ? ` (${sup.company})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Order Date</Label>
                      <DatePicker
                        value={row.orderDate}
                        onChange={(v) => updateRow(s.id, { orderDate: v })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Expected Delivery</Label>
                      <DatePicker
                        value={row.expectedDate}
                        onChange={(v) => updateRow(s.id, { expectedDate: v })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Qty to Order ({s.unit})</Label>
                      <Input
                        type="number"
                        min={0}
                        max={maxQty}
                        step="0.01"
                        value={row.quantity}
                        onChange={(e) => updateRow(s.id, { quantity: Number(e.target.value) || 0 })}
                        className={qtyInvalid ? "border-destructive" : undefined}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Up to {maxQty} {s.unit} allowed ({MAX_OVER_ORDER_PCT}% over shortfall)
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Price / Unit</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateRow(s.id, { price: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tax % *</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        placeholder="e.g. 18"
                        value={row.taxRate}
                        onChange={(e) => updateRow(s.id, { taxRate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Reference No.</Label>
                      <Input
                        value={row.referenceNo}
                        onChange={(e) => updateRow(s.id, { referenceNo: e.target.value })}
                        placeholder="Defaults to voucher no."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Other References</Label>
                      <Input
                        value={row.otherReferences}
                        onChange={(e) => updateRow(s.id, { otherReferences: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Mode/Terms of Payment</Label>
                      <Input
                        value={row.modeOfPayment}
                        onChange={(e) => updateRow(s.id, { modeOfPayment: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Dispatched Through</Label>
                      <Input
                        value={row.dispatchedThrough}
                        onChange={(e) => updateRow(s.id, { dispatchedThrough: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Destination</Label>
                      <Input
                        value={row.destination}
                        onChange={(e) => updateRow(s.id, { destination: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground">Terms of Delivery</Label>
                      <Input
                        value={row.termsOfDelivery}
                        onChange={(e) => updateRow(s.id, { termsOfDelivery: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-2">Amount</span>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOrder(s)}
                      disabled={row.submitting || qtyInvalid || row.taxRate.trim() === "" || !row.supplierId}
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {row.submitting ? "Raising…" : "Order This Item"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

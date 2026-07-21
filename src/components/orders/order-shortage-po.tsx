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

interface OrderShortagePOProps {
  orderId: string
  shortages: ShortageMaterial[]
}

// Buying a bit extra to cover wastage/rounding is fine — capped at 10% over the shortfall.
const MAX_OVER_ORDER_PCT = 10

interface RowState {
  supplierName: string
  orderDate: string
  expectedDate: string
  price: number
  quantity: number
  submitting: boolean
  done: boolean
}

function initialRow(s: ShortageMaterial): RowState {
  return {
    supplierName: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDate: "",
    price: s.cost_per_unit,
    quantity: s.shortage,
    submitting: false,
    done: false,
  }
}

export function OrderShortagePO({ orderId, shortages }: OrderShortagePOProps) {
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
    if (!row.supplierName.trim()) {
      toast.error("Enter a supplier name")
      return
    }
    updateRow(s.id, { submitting: true })
    const result = await createPurchaseOrder({
      supplier_name: row.supplierName.trim(),
      supplier_contact: "",
      order_date: row.orderDate,
      expected_date: row.expectedDate,
      notes: `Raised for material shortage on this order`,
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
                      <Input
                        value={row.supplierName}
                        onChange={(e) => updateRow(s.id, { supplierName: e.target.value })}
                        placeholder="Supplier name"
                      />
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

                  <div className="grid gap-4 sm:grid-cols-2">
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
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-2">Amount</span>
                      <span className="font-semibold">{formatCurrency(amount)}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOrder(s)}
                      disabled={row.submitting || qtyInvalid}
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

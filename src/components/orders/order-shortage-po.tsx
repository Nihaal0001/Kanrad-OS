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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

export function OrderShortagePO({ orderId, shortages }: OrderShortagePOProps) {
  const router = useRouter()
  const [prices, setPrices] = useState<Record<string, number>>(
    Object.fromEntries(shortages.map((s) => [s.id, s.cost_per_unit]))
  )
  const [supplierName, setSupplierName] = useState("")
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (shortages.length === 0) return null

  const total = shortages.reduce((sum, s) => sum + (prices[s.id] ?? 0) * s.shortage, 0)

  async function handleOrderAll() {
    if (!supplierName.trim()) {
      toast.error("Enter a supplier name")
      return
    }
    setSubmitting(true)
    const result = await createPurchaseOrder({
      supplier_name: supplierName.trim(),
      supplier_contact: "",
      order_date: orderDate,
      expected_date: expectedDate,
      notes: `Raised for material shortage on this order`,
      order_ids: [orderId],
      items: shortages.map((s) => ({
        material_id: s.id,
        quantity_ordered: s.shortage,
        unit_price: prices[s.id] ?? 0,
      })),
    })
    setSubmitting(false)

    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Purchase order raised for the shortage")
    if ("data" in result && result.data) {
      router.push(`/inventory/purchase-orders/${result.data.id}`)
    } else {
      router.refresh()
    }
  }

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Material Shortage
        </CardTitle>
        <CardDescription>
          These materials fall short of what this order&apos;s BOM needs. Prices are editable now —
          once the purchase order is raised, nothing on it can be changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Short By</TableHead>
              <TableHead className="text-right">Price / Unit</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shortages.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.sku}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums text-amber-600 font-medium">
                  {s.shortage} {s.unit}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="ml-auto h-8 w-28 text-right"
                    value={prices[s.id] ?? 0}
                    onChange={(e) =>
                      setPrices((p) => ({ ...p, [s.id]: Number(e.target.value) || 0 }))
                    }
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency((prices[s.id] ?? 0) * s.shortage)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end text-sm">
          <span className="text-muted-foreground mr-2">Total</span>
          <span className="font-semibold">{formatCurrency(total)}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="shortage-supplier">Supplier *</Label>
            <Input
              id="shortage-supplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Supplier name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Order Date</Label>
            <DatePicker value={orderDate} onChange={setOrderDate} />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Delivery</Label>
            <DatePicker value={expectedDate} onChange={setExpectedDate} />
          </div>
        </div>

        <Button className="w-full" onClick={handleOrderAll} disabled={submitting}>
          <Lock className="h-4 w-4" />
          {submitting ? "Raising Purchase Order…" : `Order All (${shortages.length} item${shortages.length === 1 ? "" : "s"})`}
        </Button>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Calculator, IndianRupee, Pencil, Save } from "lucide-react"

import { upsertOrderCosting } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

export interface OrderCostingMaterial {
  id: string
  name: string
  unit: string
  /** BOM quantity required for the order's full total_quantity (not per unit) */
  totalQtyForOrder: number
  unitPrice: number
  isOrderPrice: boolean
}

interface Props {
  orderId: string
  orderNumber: string
  productId: string | null
  productName: string
  initialQuantity: number
  materials: OrderCostingMaterial[]
  existing: {
    material_cost: number
    labor_cost: number
    overhead_cost: number
    other_cost: number
  } | null
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OrderCostingCalculator({
  orderId,
  orderNumber,
  productId,
  productName,
  initialQuantity,
  materials,
  existing,
}: Props) {
  const router = useRouter()
  const baseQty = initialQuantity > 0 ? initialQuantity : 1
  const [quantity, setQuantity] = useState(baseQty)
  const [laborCost, setLaborCost] = useState(existing ? Math.round((existing.labor_cost / baseQty) * 100) / 100 : 0)
  const [overheadCost, setOverheadCost] = useState(existing ? Math.round((existing.overhead_cost / baseQty) * 100) / 100 : 0)
  const [otherCost, setOtherCost] = useState(existing ? Math.round((existing.other_cost / baseQty) * 100) / 100 : 0)
  const [marginPct, setMarginPct] = useState(20)
  const [saving, setSaving] = useState(false)

  const bomLines = useMemo(() => {
    return materials.map((m) => {
      const perUnitQty = baseQty > 0 ? m.totalQtyForOrder / baseQty : 0
      const lineCost = perUnitQty * m.unitPrice
      return { ...m, perUnitQty, lineCost }
    })
  }, [materials, baseQty])

  const materialCostPerUnit = bomLines.reduce((s, l) => s + l.lineCost, 0)
  const totalMaterialCost = materialCostPerUnit * quantity
  const totalLaborCost = laborCost * quantity
  const totalOverheadCost = overheadCost * quantity
  const totalOtherCost = otherCost * quantity
  const totalCost = totalMaterialCost + totalLaborCost + totalOverheadCost + totalOtherCost
  const costPerUnit = quantity > 0 ? totalCost / quantity : 0
  const sellingPrice = costPerUnit * (1 + marginPct / 100)

  async function handleSave() {
    setSaving(true)
    const result = await upsertOrderCosting(orderId, {
      material_cost: Math.round(totalMaterialCost * 100) / 100,
      labor_cost: Math.round(totalLaborCost * 100) / 100,
      overhead_cost: Math.round(totalOverheadCost * 100) / 100,
      other_cost: Math.round(totalOtherCost * 100) / 100,
      notes: "",
    })
    setSaving(false)
    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Costing saved")
    router.refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">

        {/* Material Costs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Material Costs — {productName}
              </CardTitle>
              <CardDescription>
                {orderNumber} · from BOM × actual purchase price (this order&apos;s PO price where one exists)
              </CardDescription>
            </div>
            {productId && (
              <Button asChild size="sm" variant="ghost">
                <Link href={`/products/${productId}/edit`}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit BOM
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {bomLines.length === 0 ? (
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  No BOM found for this order&apos;s product.
                </p>
              ) : (
                bomLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(line.perUnitQty * 10000) / 10000} {line.unit}
                        {" × "}
                        <span>₹{formatCurrency(line.unitPrice)}</span>
                        {line.isOrderPrice && <span className="ml-1 text-blue-600 font-medium">(PO price)</span>}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0 ml-4">
                      ₹{formatCurrency(line.lineCost)}
                    </p>
                  </div>
                ))
              )}

              <div className="flex items-center justify-between px-5 py-3 bg-muted/30 font-semibold">
                <span className="text-sm">Material Cost / Unit</span>
                <span className="tabular-nums">₹{formatCurrency(materialCostPerUnit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Costs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Costs (per unit)</CardTitle>
            <CardDescription>Labor, overhead, and other charges per unit produced</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Labor Cost / Unit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={laborCost || ""}
                  onChange={(e) => setLaborCost(Number(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Overhead / Unit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={overheadCost || ""}
                  onChange={(e) => setOverheadCost(Number(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Other / Unit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={otherCost || ""}
                  onChange={(e) => setOtherCost(Number(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : existing ? "Update Costing" : "Save Costing"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel */}
      <div className="space-y-6">

        {/* Quantity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batch Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Units to Produce</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                className="h-11 text-lg font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cost Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Cost Summary
            </CardTitle>
            <CardDescription>For {quantity.toLocaleString("en-IN")} units</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Materials</span>
              <span className="tabular-nums">₹{formatCurrency(totalMaterialCost)}</span>
            </div>
            {laborCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labor</span>
                <span className="tabular-nums">₹{formatCurrency(totalLaborCost)}</span>
              </div>
            )}
            {overheadCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Overhead</span>
                <span className="tabular-nums">₹{formatCurrency(totalOverheadCost)}</span>
              </div>
            )}
            {otherCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Other</span>
                <span className="tabular-nums">₹{formatCurrency(totalOtherCost)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total Cost</span>
              <span className="tabular-nums">₹{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Cost / Unit</span>
              <span className="tabular-nums">₹{formatCurrency(costPerUnit)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Selling Price Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4" />
              Selling Price
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Target Margin (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="1"
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
              />
            </div>
            <Separator />
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cost / Unit</span>
                <span className="tabular-nums">₹{formatCurrency(costPerUnit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margin ({marginPct}%)</span>
                <span className="tabular-nums text-emerald-600">
                  +₹{formatCurrency(sellingPrice - costPerUnit)}
                </span>
              </div>
              <div className="flex justify-between text-xl font-bold pt-1">
                <span>Selling Price</span>
                <span className="tabular-nums">₹{formatCurrency(sellingPrice)}</span>
              </div>
            </div>

            {/* Badge breakdown */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="text-xs">
                Material: {materialCostPerUnit > 0 && costPerUnit > 0 ? Math.round((materialCostPerUnit / costPerUnit) * 100) : 0}%
              </Badge>
              {laborCost > 0 && (
                <Badge variant="outline" className="text-xs">
                  Labor: {Math.round((laborCost / costPerUnit) * 100)}%
                </Badge>
              )}
              {overheadCost > 0 && (
                <Badge variant="outline" className="text-xs">
                  Overhead: {Math.round((overheadCost / costPerUnit) * 100)}%
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

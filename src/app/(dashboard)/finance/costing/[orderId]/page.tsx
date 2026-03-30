import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown, Package } from "lucide-react"

import { getOrderCosting } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { CostingForm } from "@/components/finance/costing-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Props {
  params: Promise<{ orderId: string }>
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function OrderCostingPage({ params }: Props) {
  const { orderId } = await params

  let result
  try {
    result = await getOrderCosting(orderId)
  } catch {
    notFound()
  }

  const {
    order,
    costing,
    computedMaterialCost,
    totalRevenue,
    totalReceived,
    bomProduct,
    bomBreakdown,
    bomMaterialCost,
    manualMaterialCost,
  } = result!

  const totalCost = costing
    ? (costing.material_cost ?? 0) + (costing.labor_cost ?? 0) + (costing.overhead_cost ?? 0) + (costing.other_cost ?? 0)
    : computedMaterialCost
  const margin = totalRevenue > 0 ? totalRevenue - totalCost : null
  const marginPct = totalRevenue > 0 && totalCost > 0 ? Math.round((margin! / totalRevenue) * 100) : null

  return (
    <>
      <PageHeader
        title={`Costing — ${order.order_number}`}
        description={`${order.product_variant} · ${order.total_quantity.toLocaleString("en-IN")} pcs`}
        breadcrumbs={[
          { label: "Finance", href: "/finance/costing" },
          { label: "Costing", href: "/finance/costing" },
          { label: order.order_number },
        ]}
      />

      <Button variant="ghost" size="sm" asChild className="mb-6 -mt-4">
        <Link href="/finance/costing">
          <ArrowLeft className="h-4 w-4" />
          Back to Costing
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* BOM Breakdown (if order has a BOM) */}
          {bomProduct && bomBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  BOM Material Cost
                </CardTitle>
                <CardDescription>
                  Auto-calculated from{" "}
                  <Link href={`/products/${bomProduct.id}`} className="underline underline-offset-2 hover:text-foreground">
                    {bomProduct.product_name}
                  </Link>
                  {" "}({bomProduct.product_sku}) × {order.total_quantity.toLocaleString("en-IN")} units
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Qty/Unit</TableHead>
                      <TableHead className="text-right">Wastage</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {bomBreakdown.map((line: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="text-sm font-medium">{line.materialName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{line.materialSku}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{line.qtyPerUnit}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {line.wastage > 0 ? `${line.wastage}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{line.totalQty.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">₹{formatCurrency(line.costPerUnit)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">₹{formatCurrency(line.lineCost)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-semibold">
                      <TableCell colSpan={5} className="text-right">Total BOM Material Cost</TableCell>
                      <TableCell className="text-right tabular-nums">₹{formatCurrency(bomMaterialCost)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Cost Breakdown Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <CostingForm
                orderId={orderId}
                existing={costing ?? null}
                computedMaterialCost={computedMaterialCost}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">

          {/* Margin Summary */}
          {totalRevenue > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {margin !== null && margin >= 0
                    ? <TrendingUp className="h-4 w-4 text-emerald-600" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />
                  }
                  P&amp;L Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Revenue (invoiced)</span>
                  <span className="font-medium">₹{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received</span>
                  <span className="text-emerald-600 font-medium">₹{formatCurrency(totalReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium">₹{formatCurrency(totalCost)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span className={margin !== null && margin < 0 ? "text-red-500" : "text-emerald-700"}>
                    Gross Margin
                  </span>
                  <span className={margin !== null && margin < 0 ? "text-red-500" : "text-emerald-700"}>
                    ₹{formatCurrency(margin ?? 0)}
                    {marginPct !== null && <span className="ml-1 text-xs font-normal">({marginPct}%)</span>}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Material Cost Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {bomProduct ? (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">BOM</Badge>
                    <span className="text-muted-foreground">Auto-calculated from product BOM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BOM Cost</span>
                    <span className="font-semibold">₹{formatCurrency(bomMaterialCost)}</span>
                  </div>
                  {manualMaterialCost > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Manual Allocation</span>
                      <span>₹{formatCurrency(manualMaterialCost)}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Manual</Badge>
                    <span className="text-muted-foreground">From allocated materials</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Allocated Cost</span>
                    <span className="font-semibold">₹{formatCurrency(manualMaterialCost)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Link a product BOM to this order to auto-calculate material costs.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Allocated Materials (manual) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocated Materials</CardTitle>
            </CardHeader>
            <CardContent>
              {order.order_materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials manually allocated for this order.</p>
              ) : (
                <div className="space-y-3">
                  {order.order_materials.map((om: { id: string; quantity_allocated: number; material: { name?: string; cost_per_unit?: number; unit?: string } | null }) => {
                    const cost = om.quantity_allocated * (om.material?.cost_per_unit ?? 0)
                    return (
                      <div key={om.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{om.material?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {om.quantity_allocated} {om.material?.unit ?? ""} × ₹{formatCurrency(om.material?.cost_per_unit ?? 0)}
                          </p>
                        </div>
                        <p className="text-sm font-medium shrink-0">₹{formatCurrency(cost)}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

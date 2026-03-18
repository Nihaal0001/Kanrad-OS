import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react"

import { getOrderCosting } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { CostingForm } from "@/components/finance/costing-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface Props {
  params: Promise<{ orderId: string }>
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

export default async function OrderCostingPage({ params }: Props) {
  const { orderId } = await params

  let result
  try {
    result = await getOrderCosting(orderId)
  } catch {
    notFound()
  }

  const { order, costing, computedMaterialCost, totalRevenue, totalReceived } = result!

  const totalCost = costing
    ? (costing.material_cost ?? 0) + (costing.labor_cost ?? 0) + (costing.overhead_cost ?? 0)
    : computedMaterialCost
  const margin = totalRevenue > 0 ? totalRevenue - totalCost : null
  const marginPct = totalRevenue > 0 && totalCost > 0 ? Math.round((margin! / totalRevenue) * 100) : null

  return (
    <>
      <PageHeader
        title={`Costing — ${order.order_number}`}
        description={`${order.style_name} · ${order.total_quantity.toLocaleString("en-IN")} pcs`}
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
        <div className="lg:col-span-2">
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocated Materials</CardTitle>
            </CardHeader>
            <CardContent>
              {order.order_materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No materials allocated for this order.</p>
              ) : (
                <div className="space-y-3">
                  {order.order_materials.map((om) => {
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
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                    <span>Total Materials</span>
                    <span>₹{formatCurrency(computedMaterialCost)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </>
  )
}

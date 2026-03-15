import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getOrderCosting } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { CostingForm } from "@/components/finance/costing-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

  const { order, costing, computedMaterialCost } = result!

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

        {/* Materials sidebar */}
        <div>
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
    </>
  )
}

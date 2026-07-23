import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react"

import { getOrderCosting } from "@/actions/finance"
import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { OrderCostingCalculator } from "@/components/finance/order-costing-calculator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

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
    totalRevenue,
    totalReceived,
    materialBreakdown,
  } = result!

  const products = await getProducts()
  const product = products.find((p) => p.product_name === order.product_variant) ?? null

  const totalCost = costing
    ? (costing.material_cost ?? 0) + (costing.labor_cost ?? 0) + (costing.overhead_cost ?? 0) + (costing.other_cost ?? 0)
    : materialBreakdown.reduce((s, m) => s + m.line_cost, 0)
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

      <div className="space-y-6">
        <OrderCostingCalculator
          orderId={order.id}
          orderNumber={order.order_number}
          productId={product?.id ?? null}
          productName={order.product_variant}
          initialQuantity={order.total_quantity}
          materials={materialBreakdown.map((m) => ({
            id: m.id,
            name: m.name,
            unit: m.unit,
            totalQtyForOrder: m.quantity,
            unitPrice: m.unit_price,
            isOrderPrice: m.is_order_price,
          }))}
          existing={costing ?? null}
        />

        {totalRevenue > 0 && (
          <Card className="lg:w-1/3 lg:ml-auto">
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
      </div>
    </>
  )
}

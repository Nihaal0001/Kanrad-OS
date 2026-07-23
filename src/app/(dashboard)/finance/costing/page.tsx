import Link from "next/link"
import { Calculator, AlertTriangle } from "lucide-react"

import { getOrders } from "@/actions/orders"
import { getOrderCostings } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function CostingPage() {
  const [orders, costings] = await Promise.all([getOrders(), getOrderCostings()])

  const costedOrderIds = new Set(costings.map((c) => c.order?.id).filter(Boolean))
  const needsCosting = orders.filter((o) => !costedOrderIds.has(o.id) && o.status !== "cancelled")

  return (
    <>
      <PageHeader
        title="Costing"
        description="Cost breakdown per order — required before an order can be confirmed or logged into production"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Costing" }]}
      />

      {needsCosting.length > 0 && (
        <div className="mb-8 space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            Needs Costing ({needsCosting.length})
          </h3>
          <div className="space-y-2">
            {needsCosting.map((o) => (
              <Link key={o.id} href={`/finance/costing/${o.id}`}>
                <Card className="border-amber-500/30 transition-colors hover:bg-accent/30">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{o.order_number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {o.product_variant}
                        {o.customer && ` · ${o.customer.name}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-600">
                      Not Costed
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
        Costed Orders ({costings.length})
      </h3>

      {costings.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No costed orders yet"
          description="Cost breakdown appears here once an order's costing is saved."
        />
      ) : (
        <div className="space-y-2">
          {costings.map((c) => (
            <Link key={c.id} href={`/finance/costing/${c.order?.id}`}>
              <Card className="transition-colors hover:bg-accent/30">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{c.order?.order_number ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.order?.product_variant ?? "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">₹{formatCurrency(c.total_cost)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

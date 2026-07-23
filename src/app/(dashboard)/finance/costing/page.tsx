import { Calculator } from "lucide-react"

import { getOrders } from "@/actions/orders"
import { getOrderCostings } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { OrderCostingPicker } from "@/components/finance/order-costing-picker"

export default async function CostingPage() {
  const [orders, costings] = await Promise.all([
    getOrders(),
    getOrderCostings(),
  ])

  const costedOrderIds = new Set(costings.map((c) => c.order?.id).filter(Boolean))
  const costableOrders = orders
    .filter((o) => o.status !== "cancelled")
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      product_variant: o.product_variant,
      customer_name: o.customer?.name ?? null,
      hasCosting: costedOrderIds.has(o.id),
    }))

  return (
    <>
      <PageHeader
        title="Costing"
        description="Calculate an order's cost from its BOM + additional expenses"
      />

      {costableOrders.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No orders yet"
          description="Create an order to start calculating its cost."
        />
      ) : (
        <OrderCostingPicker orders={costableOrders} />
      )}
    </>
  )
}

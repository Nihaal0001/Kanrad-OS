export const revalidate = 60

import { Factory } from "lucide-react"

import { getProductionOverview, getOrdersForProduction } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ProductionList } from "@/components/production/production-list"
import { LogProductionDialog } from "@/components/production/log-production-dialog"

export default async function ProductionPage() {
  const [orders, activeOrders] = await Promise.all([
    getProductionOverview(),
    getOrdersForProduction(),
  ])

  return (
    <>
      <PageHeader
        title="Production"
        description="Record daily production output for each active order"
      >
        {activeOrders.length > 0 && (
          <LogProductionDialog orders={activeOrders} />
        )}
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No active production"
          description="Confirm an order to start logging its production output."
          action={{ label: "View Orders", href: "/orders" }}
        />
      ) : (
        <ProductionList orders={orders} />
      )}
    </>
  )
}

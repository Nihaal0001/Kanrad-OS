import { Truck } from "lucide-react"

import { getShipments, getOrdersForSelect } from "@/actions/logistics"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { LogisticsTable } from "@/components/logistics/logistics-table"
import { LogisticsForm } from "@/components/logistics/logistics-form"

export default async function LogisticsPage() {
  const [shipments, orders] = await Promise.all([
    getShipments(),
    getOrdersForSelect(),
  ])

  return (
    <>
      <PageHeader
        title="Logistics"
        description="Track shipments, couriers, and delivery status for all dispatched orders"
        breadcrumbs={[{ label: "Logistics" }]}
      >
        <LogisticsForm orders={orders} />
      </PageHeader>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Create a shipment when an order is ready for dispatch."
        />
      ) : (
        <LogisticsTable shipments={shipments} />
      )}
    </>
  )
}

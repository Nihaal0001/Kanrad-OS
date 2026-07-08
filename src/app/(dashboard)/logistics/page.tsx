import { Truck } from "lucide-react"

import { getShipments, getWarehouseStockForOrders } from "@/actions/logistics"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { LogisticsTable } from "@/components/logistics/logistics-table"
import { WarehouseDispatchForm } from "@/components/logistics/warehouse-dispatch-form"

export default async function LogisticsPage() {
  const [shipments, warehouseStock] = await Promise.all([
    getShipments(),
    getWarehouseStockForOrders(),
  ])

  return (
    <>
      <PageHeader
        title="Logistics"
        description="Ship finished goods and track couriers and delivery status"
        breadcrumbs={[{ label: "Logistics" }]}
      >
        <WarehouseDispatchForm stock={warehouseStock} />
      </PageHeader>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No shipments yet"
          description="Ship an order's finished goods from the warehouse to create your first shipment."
        />
      ) : (
        <LogisticsTable shipments={shipments} />
      )}
    </>
  )
}

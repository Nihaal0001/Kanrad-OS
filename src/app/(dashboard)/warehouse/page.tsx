import { Warehouse } from "lucide-react"

import { getWarehouseItems, getWarehouseLocations, getProducedItems } from "@/actions/warehouse"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { WarehouseTable } from "@/components/warehouse/warehouse-table"
import { WarehouseForm } from "@/components/warehouse/warehouse-form"

export default async function WarehousePage() {
  const [items, locations, producedItems] = await Promise.all([
    getWarehouseItems(),
    getWarehouseLocations(),
    getProducedItems(),
  ])

  return (
    <>
      <PageHeader
        title="Warehouse"
        description="Track finished goods in the warehouse — location, quantity, and dispatch status"
        breadcrumbs={[{ label: "Warehouse" }]}
      >
        <WarehouseForm producedItems={producedItems} />
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouse items yet"
          description="Add finished goods to the warehouse to start tracking inventory."
        />
      ) : (
        <WarehouseTable items={items} locations={locations} />
      )}
    </>
  )
}

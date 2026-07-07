import { Warehouse } from "lucide-react"

import { getWarehouseItems, getWarehouseLocations } from "@/actions/warehouse"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { WarehouseTable } from "@/components/warehouse/warehouse-table"

export default async function WarehousePage() {
  const [items, locations] = await Promise.all([
    getWarehouseItems(),
    getWarehouseLocations(),
  ])

  return (
    <>
      <PageHeader
        title="Warehouse"
        description="Finished goods, synced automatically from production output — location, quantity, and dispatch status"
        breadcrumbs={[{ label: "Warehouse" }]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No warehouse items yet"
          description="Finished goods appear here automatically as production output is logged."
        />
      ) : (
        <WarehouseTable items={items} locations={locations} />
      )}
    </>
  )
}

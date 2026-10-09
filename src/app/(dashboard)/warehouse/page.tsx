import { Warehouse } from "lucide-react"

import { getWarehouseItems, getWarehouseLocations, getWarehouseDispatches } from "@/actions/warehouse"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { WarehouseTable } from "@/components/warehouse/warehouse-table"
import { WarehouseDispatchesList } from "@/components/warehouse/warehouse-dispatches-list"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default async function WarehousePage() {
  const [items, locations, dispatches] = await Promise.all([
    getWarehouseItems(),
    getWarehouseLocations(),
    getWarehouseDispatches(),
  ])

  return (
    <>
      <PageHeader
        title="Warehouse"
        description="Finished goods, synced automatically from production output — location, quantity, and dispatch status"
        breadcrumbs={[{ label: "Warehouse" }]}
      />

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          {items.length === 0 ? (
            <EmptyState
              icon={Warehouse}
              title="No warehouse items yet"
              description="Finished goods appear here automatically as production output is logged."
            />
          ) : (
            <WarehouseTable items={items} locations={locations} />
          )}
        </TabsContent>

        <TabsContent value="dispatched">
          <WarehouseDispatchesList dispatches={dispatches} />
        </TabsContent>
      </Tabs>
    </>
  )
}

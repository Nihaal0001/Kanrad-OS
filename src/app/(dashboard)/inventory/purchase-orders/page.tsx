import Link from "next/link"
import { ShoppingCart, Plus } from "lucide-react"

import { getPurchaseOrders } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PurchaseOrdersTable } from "@/components/inventory/purchase-orders-table"

export default async function PurchaseOrdersPage() {
  const purchaseOrders = await getPurchaseOrders()

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Manage material purchase orders from suppliers"
      >
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to Inventory</Link>
        </Button>
        <Button asChild>
          <Link href="/inventory/purchase-orders/new">
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </PageHeader>

      {purchaseOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders yet"
          description="Create your first purchase order to start tracking material procurement."
          action={{
            label: "Create Purchase Order",
            href: "/inventory/purchase-orders/new",
          }}
        />
      ) : (
        <PurchaseOrdersTable purchaseOrders={purchaseOrders} />
      )}
    </>
  )
}

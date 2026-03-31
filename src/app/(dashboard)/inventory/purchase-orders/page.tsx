import Link from "next/link"
import { ShoppingCart, ClipboardCheck } from "lucide-react"

import { getPurchaseOrders, getMaterials } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PurchaseOrdersTable } from "@/components/inventory/purchase-orders-table"
import { CreatePurchaseOrderSheet } from "@/components/inventory/create-po-sheet"

export default async function PurchaseOrdersPage() {
  const [purchaseOrders, pendingCount, materials] = await Promise.all([
    getPurchaseOrders(),
    getPurchaseOrders({ approval_status: "pending_approval" }).then((r) => r.length),
    getMaterials(),
  ])

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        description="Manage material purchase orders from suppliers"
      >
        <Button variant="outline" asChild>
          <Link href="/inventory/approvals" className="relative">
            <ClipboardCheck className="h-4 w-4" />
            Approvals
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white font-semibold leading-none">
                {pendingCount}
              </span>
            )}
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/inventory">Back to Inventory</Link>
        </Button>
        <CreatePurchaseOrderSheet
          materials={materials.map((m) => ({
            id: m.id,
            name: m.name,
            sku: m.sku,
            unit: m.unit,
            cost_per_unit: m.cost_per_unit,
          }))}
        />
      </PageHeader>

      {purchaseOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase orders yet"
          description="Create your first purchase order to start tracking material procurement."
        />
      ) : (
        <PurchaseOrdersTable purchaseOrders={purchaseOrders} />
      )}
    </>
  )
}

import Link from "next/link"
import { ShoppingBag, Plus } from "lucide-react"

import { getOrders } from "@/actions/orders"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { OrdersTable } from "@/components/orders/orders-table"

export default async function OrdersPage() {
  const orders = await getOrders()

  return (
    <>
      <PageHeader
        title="Orders"
        description="Manage customer orders and track their progress"
      >
        <Button variant="outline" asChild>
          <Link href="/customers">Manage Customers</Link>
        </Button>
        <Button asChild>
          <Link href="/orders/new">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </Button>
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Create your first order to get started tracking production."
          action={{ label: "Create Order", href: "/orders/new" }}
        />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </>
  )
}

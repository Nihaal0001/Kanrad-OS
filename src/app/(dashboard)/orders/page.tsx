import Link from "next/link"
import { ShoppingBag, Plus } from "lucide-react"

import { getOrders } from "@/actions/orders"
import { getBuyers } from "@/actions/buyers"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { OrdersTable } from "@/components/orders/orders-table"

export default async function OrdersPage() {
  const [orders, buyers] = await Promise.all([getOrders(), getBuyers()])

  return (
    <>
      <PageHeader
        title="Orders"
        description="Manage buyer orders and track their progress"
      >
        <Button variant="outline" asChild>
          <Link href="/orders/buyers">Manage Buyers</Link>
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

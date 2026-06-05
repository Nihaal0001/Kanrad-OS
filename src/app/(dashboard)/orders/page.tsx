export const revalidate = 60

import Link from "next/link"
import { ShoppingBag } from "lucide-react"

import { getOrders } from "@/actions/orders"
import { getCustomers } from "@/actions/customers"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { OrdersTable } from "@/components/orders/orders-table"
import { CreateOrderSheet } from "@/components/orders/create-order-sheet"

export default async function OrdersPage() {
  const [orders, customers] = await Promise.all([
    getOrders(),
    getCustomers(),
  ])

  return (
    <>
      <PageHeader
        title="Orders"
        description="Manage customer orders and track their progress"
      >
        <Button variant="outline" asChild>
          <Link href="/customers">Manage Customers</Link>
        </Button>
        <CreateOrderSheet
          customers={customers.map((c) => ({
            id: c.id,
            name: c.name,
            company: c.company,
          }))}
        />
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Create your first order to get started tracking production."
        />
      ) : (
        <OrdersTable orders={orders} />
      )}
    </>
  )
}

import { notFound } from "next/navigation"

import { getOrder } from "@/actions/orders"
import { getCustomers } from "@/actions/customers"
import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { OrderForm } from "@/components/orders/order-form"
import type { OrderDetail } from "@/lib/supabase/types"

interface EditOrderPageProps {
  params: Promise<{ id: string }>
}

export default async function EditOrderPage({ params }: EditOrderPageProps) {
  const { id } = await params
  let order: OrderDetail

  try {
    order = await getOrder(id)
  } catch {
    notFound()
  }

  const [customers, products] = await Promise.all([
    getCustomers(),
    getProducts(),
  ])

  return (
    <>
      <PageHeader
        title={`Edit Order ${order.order_number}`}
        description="Update order details and items"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: order.order_number, href: `/orders/${order.id}` },
          { label: "Edit" },
        ]}
      />
      <OrderForm
        order={order}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company,
        }))}
        products={products.map((p) => ({
          id: p.id,
          product_sku: p.product_sku,
          product_name: p.product_name,
          category: p.category,
          materialCost: p.materialCost,
        }))}
      />
    </>
  )
}

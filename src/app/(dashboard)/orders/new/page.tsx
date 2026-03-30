import { getCustomers } from "@/actions/customers"
import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { OrderForm } from "@/components/orders/order-form"

export default async function NewOrderPage() {
  const [customers, products] = await Promise.all([
    getCustomers(),
    getProducts(),
  ])

  return (
    <>
      <PageHeader
        title="New Order"
        description="Create a new production order"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "New Order" },
        ]}
      />
      <OrderForm
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

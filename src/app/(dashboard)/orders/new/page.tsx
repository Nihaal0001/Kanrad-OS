import { getCustomers } from "@/actions/customers"
import { PageHeader } from "@/components/shared/page-header"
import { OrderForm } from "@/components/orders/order-form"

export default async function NewOrderPage() {
  const customers = await getCustomers()

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
      />
    </>
  )
}

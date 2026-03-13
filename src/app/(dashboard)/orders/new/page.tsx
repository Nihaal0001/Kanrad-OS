import { getBuyers } from "@/actions/buyers"
import { PageHeader } from "@/components/shared/page-header"
import { OrderForm } from "@/components/orders/order-form"

export default async function NewOrderPage() {
  const buyers = await getBuyers()

  return (
    <>
      <PageHeader
        title="New Order"
        description="Create a new production order"
      />
      <OrderForm
        buyers={buyers.map((b) => ({
          id: b.id,
          name: b.name,
          company: b.company,
        }))}
      />
    </>
  )
}

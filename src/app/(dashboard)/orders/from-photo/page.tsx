import { getCustomers } from "@/actions/customers"
import { PageHeader } from "@/components/shared/page-header"
import { PhotoOrderWorkspace } from "@/components/orders/photo-order-workspace"

export default async function OrderFromPhotoPage() {
  const customers = await getCustomers()

  return (
    <>
      <PageHeader
        title="Order from Photo"
        description="Photograph a handwritten order sheet, check what was read, then save it as a draft order"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "Order from Photo" },
        ]}
      />
      <PhotoOrderWorkspace
        customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))}
      />
    </>
  )
}

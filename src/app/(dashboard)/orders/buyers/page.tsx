import { getBuyers } from "@/actions/buyers"
import { PageHeader } from "@/components/shared/page-header"
import { BuyersTable } from "@/components/orders/buyers-table"

export default async function BuyersPage() {
  const buyers = await getBuyers()

  return (
    <>
      <PageHeader
        title="Buyers"
        description="Manage your buyer contacts and details"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "Buyers" },
        ]}
      />
      <BuyersTable buyers={buyers} />
    </>
  )
}

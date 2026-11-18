import { getCustomers } from "@/actions/customers"
import { PageHeader } from "@/components/shared/page-header"
import { ScanBillWorkspace } from "@/components/scan-bill/scan-bill-workspace"

export default async function ScanBillPage() {
  const customers = await getCustomers()

  return (
    <>
      <PageHeader
        title="Scan Bill"
        description="Photograph a bill, check what was read, then add it to Inventory and Finance"
        breadcrumbs={[{ label: "Scan Bill" }]}
      />
      <ScanBillWorkspace customers={customers.map((c) => ({ id: c.id, name: c.name, company: c.company }))} />
    </>
  )
}

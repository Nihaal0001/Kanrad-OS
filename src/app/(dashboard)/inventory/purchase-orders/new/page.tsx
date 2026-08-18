import { getMaterials } from "@/actions/inventory"
import { getSuppliers } from "@/actions/suppliers"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseOrderForm } from "@/components/inventory/purchase-order-form"

export default async function NewPurchaseOrderPage() {
  const [materials, suppliers] = await Promise.all([
    getMaterials(),
    getSuppliers(),
  ])

  const materialOptions = materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    cost_per_unit: m.cost_per_unit,
    category_name: (m.category as { name: string } | null)?.name ?? null,
  }))

  const supplierOptions = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company,
  }))

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        description="Stock up on materials ahead of season — not tied to a specific customer order"
        breadcrumbs={[
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: "New" },
        ]}
      />
      <PurchaseOrderForm materials={materialOptions} suppliers={supplierOptions} />
    </>
  )
}

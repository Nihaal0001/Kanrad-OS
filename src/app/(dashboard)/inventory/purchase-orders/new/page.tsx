import { getMaterials } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseOrderForm } from "@/components/inventory/purchase-order-form"

export default async function NewPurchaseOrderPage() {
  const materials = await getMaterials()

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        description="Create a material purchase order for a supplier"
      />
      <PurchaseOrderForm
        materials={materials.map((m) => ({
          id: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
        }))}
      />
    </>
  )
}

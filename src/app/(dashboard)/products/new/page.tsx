import { getMaterials } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { BomForm } from "@/components/products/bom-form"

export default async function NewProductPage() {
  const materials = await getMaterials()
  const activeMaterials = materials
    .filter((m) => m.is_active)
    .map((m) => ({
      id: m.id,
      name: m.name,
      sku: m.sku,
      cost_per_unit: m.cost_per_unit,
      unit: m.unit,
      current_stock: m.current_stock,
    }))

  return (
    <>
      <PageHeader
        title="New Product"
        description="Define a product and its Bill of Materials"
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "New Product" },
        ]}
      />
      <BomForm materials={activeMaterials} />
    </>
  )
}

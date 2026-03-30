import { notFound } from "next/navigation"

import { getProduct } from "@/actions/bom"
import { getMaterials } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { BomForm } from "@/components/products/bom-form"

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params

  let product
  try {
    product = await getProduct(id)
  } catch {
    notFound()
  }

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
        title={`Edit — ${product.product_name}`}
        description={`SKU: ${product.product_sku}`}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: product.product_name, href: `/products/${id}` },
          { label: "Edit" },
        ]}
      />
      <BomForm product={product} materials={activeMaterials} />
    </>
  )
}

import { Calculator } from "lucide-react"

import { getProducts } from "@/actions/bom"
import { getMaterials } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ProductCostingCalculator } from "@/components/products/product-costing-calculator"
import { CreateProductSheet } from "@/components/products/create-product-sheet"

interface Props {
  searchParams: Promise<{ product?: string }>
}

export default async function CostingPage({ searchParams }: Props) {
  const { product: selectedProductId } = await searchParams
  const [products, materials] = await Promise.all([
    getProducts(),
    getMaterials(),
  ])

  const materialOptions = materials.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    cost_per_unit: m.cost_per_unit,
    unit: m.unit,
  }))

  return (
    <>
      <PageHeader
        title="Costing"
        description="Calculate product cost from BOM + additional expenses"
      >
        <CreateProductSheet materials={materialOptions} />
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={Calculator}
          title="No products defined"
          description="Create a product with a Bill of Materials to start calculating costs."
        />
      ) : (
        <ProductCostingCalculator
          products={products}
          initialProductId={selectedProductId}
        />
      )}
    </>
  )
}

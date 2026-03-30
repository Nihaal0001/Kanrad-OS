import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { ProductCostingCalculator } from "@/components/products/product-costing-calculator"

interface Props {
  searchParams: Promise<{ product?: string }>
}

export default async function ProductCostingPage({ searchParams }: Props) {
  const { product: selectedProductId } = await searchParams
  const products = await getProducts()

  return (
    <>
      <PageHeader
        title="Product Costing"
        description="Calculate product cost from BOM + additional expenses"
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: "Costing" },
        ]}
      >
        <Button asChild variant="outline">
          <Link href="/products/new">
            <Plus className="h-4 w-4" />
            New Product
          </Link>
        </Button>
      </PageHeader>

      <ProductCostingCalculator
        products={products}
        initialProductId={selectedProductId}
      />
    </>
  )
}

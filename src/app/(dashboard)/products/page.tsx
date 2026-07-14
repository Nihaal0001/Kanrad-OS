import Link from "next/link"
import { Plus, Package, Calculator } from "lucide-react"

import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { ProductsTable } from "@/components/products/products-table"

export default async function ProductsPage() {
  const products = await getProducts()

  return (
    <>
      <PageHeader
        title="Product Master"
        description="Define products with Bill of Materials linked to Master Inventory"
        breadcrumbs={[{ label: "Products" }]}
      >
        <Button asChild variant="outline">
          <Link href="/products/costing">
            <Calculator className="h-4 w-4" />
            Product Costing
          </Link>
        </Button>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="h-4 w-4" />
            New Product
          </Link>
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products defined"
          description="Create your first product with a Bill of Materials to start tracking material costs and pricing."
          action={{ label: "Create Product", href: "/products/new" }}
        />
      ) : (
        <ProductsTable products={products} />
      )}
    </>
  )
}

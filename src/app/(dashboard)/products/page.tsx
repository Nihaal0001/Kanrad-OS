import Link from "next/link"
import { Plus, Package, Calculator } from "lucide-react"

import { getProducts } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Materials</TableHead>
                  <TableHead className="text-right">BOM Cost / Unit</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="font-mono text-xs hover:underline">
                        {p.product_sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                        {p.product_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {p.category ? (
                        <Badge variant="outline">{p.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{p.bom_items.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {p.materialCost > 0
                        ? `₹${formatCurrency(p.materialCost)}`
                        : <span className="text-amber-500 text-sm">No prices</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link href={`/products/costing?product=${p.id}`}>
                          <Calculator className="h-3.5 w-3.5" />
                          Costing
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

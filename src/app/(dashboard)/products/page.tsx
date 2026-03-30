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
        description="Define products with Bill of Materials (BOM) to auto-calculate material costs for costing and pricing"
        breadcrumbs={[{ label: "Products" }]}
      >
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
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      <Calculator className="h-3.5 w-3.5" />
                      BOM Cost / Unit
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40">
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
                      ₹{formatCurrency(p.materialCost)}
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

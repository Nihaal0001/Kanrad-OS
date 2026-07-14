"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, Calculator } from "lucide-react"

import { Input } from "@/components/ui/input"
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

interface ProductRow {
  id: string
  product_sku: string
  product_name: string
  category: string | null
  bom_items: unknown[]
  materialCost: number
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.product_sku.toLowerCase().includes(q) ||
        p.product_name.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    )
  }, [products, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search BOMs by SKU, name, or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No BOMs found matching your search.</p>
        </div>
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
                {filtered.map((p) => (
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
    </div>
  )
}

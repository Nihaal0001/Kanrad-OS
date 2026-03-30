import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil, Calculator, Package, AlertTriangle } from "lucide-react"

import { getProduct } from "@/actions/bom"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"

interface Props {
  params: Promise<{ id: string }>
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function ProductDetailPage({ params }: Props) {
  const { id } = await params

  let product
  try {
    product = await getProduct(id)
  } catch {
    notFound()
  }

  // Calculate costs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bomLines = product.bom_items.map((item: any) => {
    const costPerUnit = item.material?.cost_per_unit ?? 0
    const effectiveQty = item.qty_required * (1 + (item.wastage_pct ?? 0) / 100)
    const lineCost = effectiveQty * costPerUnit
    const lowStock = item.material ? item.material.current_stock < item.qty_required : false
    return { ...item, effectiveQty, lineCost, lowStock }
  })

  const totalBomCost = bomLines.reduce((sum: number, l: { lineCost: number }) => sum + l.lineCost, 0)
  const hasLowStock = bomLines.some((l: { lowStock: boolean }) => l.lowStock)

  return (
    <>
      <PageHeader
        title={product.product_name}
        description={`SKU: ${product.product_sku}${product.category ? ` · ${product.category}` : ""}`}
        breadcrumbs={[
          { label: "Products", href: "/products" },
          { label: product.product_name },
        ]}
      >
        <Button variant="outline" asChild>
          <Link href={`/products/${id}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild className="mb-6 -mt-4">
        <Link href="/products">
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* BOM Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calculator className="h-4 w-4" />
                Bill of Materials
              </CardTitle>
              <CardDescription>
                Materials needed to produce one unit
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Wastage</TableHead>
                    <TableHead className="text-right">Effective Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {bomLines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-medium">{line.material?.name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{line.material?.sku}</p>
                          </div>
                          {line.lowStock && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{line.qty_required}</TableCell>
                      <TableCell>{line.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.wastage_pct > 0 ? `${line.wastage_pct}%` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{line.effectiveQty.toFixed(4)}</TableCell>
                      <TableCell className="text-right tabular-nums">₹{formatCurrency(line.material?.cost_per_unit ?? 0)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">₹{formatCurrency(line.lineCost)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={6} className="text-right">Total Material Cost</TableCell>
                    <TableCell className="text-right tabular-nums">₹{formatCurrency(totalBomCost)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cost Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Cost Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Material Cost / Unit</span>
                <span className="font-semibold tabular-nums">₹{formatCurrency(totalBomCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Materials Count</span>
                <Badge variant="secondary">{bomLines.length}</Badge>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Cost Calculator</p>
                <CostCalculator bomCost={totalBomCost} />
              </div>
            </CardContent>
          </Card>

          {/* Stock Warnings */}
          {hasLowStock && (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock Warning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {bomLines.filter((l: any) => l.lowStock).map((line: any) => (
                  <div key={line.id} className="flex justify-between">
                    <span>{line.material?.name}</span>
                    <span className="text-amber-600 font-medium">
                      {line.material?.current_stock} {line.unit} left
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {product.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

// Client component for the quick cost calculator
function CostCalculator({ bomCost }: { bomCost: number }) {
  return <CostCalculatorClient bomCost={bomCost} />
}

import { CostCalculatorClient } from "@/components/products/cost-calculator"

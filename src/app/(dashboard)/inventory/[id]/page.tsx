import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil, ArrowUpDown } from "lucide-react"

import { getMaterial, getStockTransactions } from "@/actions/inventory"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StockLevelBar } from "@/components/inventory/stock-level-bar"

interface MaterialDetailPageProps {
  params: Promise<{ id: string }>
}

const txnTypeLabels: Record<string, { label: string; color: string }> = {
  purchase_in: { label: "Purchase In", color: "text-emerald-600" },
  production_out: { label: "Production Out", color: "text-red-600" },
  adjustment: { label: "Adjustment", color: "text-blue-600" },
  return: { label: "Return", color: "text-amber-600" },
}

export default async function MaterialDetailPage({ params }: MaterialDetailPageProps) {
  const { id } = await params

  let material
  try {
    material = await getMaterial(id)
  } catch {
    notFound()
  }

  const transactions = await getStockTransactions(id)

  return (
    <>
      <PageHeader
        title={material.name}
        description={`SKU: ${material.sku}`}
      >
        <Button variant="outline" asChild>
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/inventory/${id}/adjust`}>
            <ArrowUpDown className="h-4 w-4" />
            Adjust Stock
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/inventory/${id}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Material Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Material Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Category</dt>
                  <dd className="mt-1 font-medium">
                    {material.category?.name ?? "--"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Unit</dt>
                  <dd className="mt-1 font-medium">{material.unit}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Cost per Unit</dt>
                  <dd className="mt-1 font-medium">
                    {formatCurrency(material.cost_per_unit)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Location</dt>
                  <dd className="mt-1 font-medium">{material.location ?? "--"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Supplier</dt>
                  <dd className="mt-1 font-medium">
                    {material.supplier_name ?? "--"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Supplier Contact</dt>
                  <dd className="mt-1 font-medium">
                    {material.supplier_contact ?? "--"}
                  </dd>
                </div>
              </dl>
              {material.notes && (
                <div className="mt-4 pt-4 border-t">
                  <dt className="text-sm text-muted-foreground">Notes</dt>
                  <dd className="mt-1 text-sm whitespace-pre-wrap">
                    {material.notes}
                  </dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>
                Stock movements for this material
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No transactions yet.
                </p>
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => {
                        const typeInfo = txnTypeLabels[txn.type] ?? {
                          label: txn.type,
                          color: "",
                        }
                        return (
                          <TableRow key={txn.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(txn.created_at)}
                            </TableCell>
                            <TableCell>
                              <span className={typeInfo.color}>
                                {typeInfo.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {txn.quantity > 0 ? "+" : ""}
                              {txn.quantity}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {txn.notes ?? "--"}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stock Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Stock Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Current Stock</p>
                <p className="text-3xl font-bold tabular-nums">
                  {material.current_stock.toLocaleString("en-IN")}
                  <span className="text-lg font-normal text-muted-foreground ml-1">
                    {material.unit}
                  </span>
                </p>
              </div>

              <StockLevelBar
                current={material.current_stock}
                minimum={material.min_stock_level}
              />

              <div>
                <p className="text-sm text-muted-foreground">
                  Minimum Stock Level
                </p>
                <p className="font-medium">
                  {material.min_stock_level} {material.unit}
                </p>
              </div>

              {material.current_stock <= material.min_stock_level &&
                material.min_stock_level > 0 && (
                  <Badge variant="destructive" className="w-full justify-center">
                    Low Stock Alert
                  </Badge>
                )}

              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Total Stock Value
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrency(
                    material.current_stock * material.cost_per_unit
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/inventory/${id}/adjust`}>
                  <ArrowUpDown className="h-4 w-4" />
                  Adjust Stock
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/inventory/${id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Edit Material
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

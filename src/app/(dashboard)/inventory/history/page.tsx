import Link from "next/link"
import { ArrowLeft, TrendingUp, TrendingDown, ArrowUpDown, RotateCcw } from "lucide-react"

import { getAllStockTransactions } from "@/actions/inventory"
import { formatDate, formatDateRelative, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

interface HistoryPageProps {
  searchParams: Promise<{ type?: string }>
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  purchase_in:    { label: "Purchase In",    icon: TrendingUp,   color: "text-emerald-600", bg: "bg-emerald-500/10" },
  production_out: { label: "Production Out", icon: TrendingDown, color: "text-red-500",     bg: "bg-red-500/10" },
  adjustment:     { label: "Adjustment",     icon: ArrowUpDown,  color: "text-blue-500",    bg: "bg-blue-500/10" },
  return:         { label: "Return",         icon: RotateCcw,    color: "text-amber-500",   bg: "bg-amber-500/10" },
}

const TYPE_FILTERS = [
  { value: "", label: "All Movements" },
  { value: "purchase_in", label: "Stock In" },
  { value: "production_out", label: "Stock Out" },
  { value: "adjustment", label: "Adjustments" },
  { value: "return", label: "Returns" },
]

export default async function InventoryHistoryPage({ searchParams }: HistoryPageProps) {
  const { type } = await searchParams
  const transactions = await getAllStockTransactions({ type: type || undefined })

  const totalIn = transactions.filter((t) => t.quantity > 0).reduce((s, t) => s + t.quantity, 0)
  const totalOut = transactions.filter((t) => t.quantity < 0).reduce((s, t) => s + Math.abs(t.quantity), 0)

  return (
    <>
      <PageHeader
        title="Stock History"
        description="All inventory movements — incoming and outgoing"
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Stock History" },
        ]}
      >
        <Button variant="outline" asChild>
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="text-center py-3">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground">Total Movements</p>
            <p className="text-2xl font-bold">{transactions.length}</p>
          </CardContent>
        </Card>
        <Card className="text-center py-3 border-emerald-200 bg-emerald-500/5">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground">Stock In</p>
            <p className="text-2xl font-bold text-emerald-600">+{totalIn.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card className="text-center py-3 border-red-200 bg-red-500/5">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground">Stock Out</p>
            <p className="text-2xl font-bold text-red-500">-{totalOut.toLocaleString("en-IN")}</p>
          </CardContent>
        </Card>
        <Card className="text-center py-3">
          <CardContent className="p-0">
            <p className="text-xs text-muted-foreground">Net Change</p>
            <p className={cn("text-2xl font-bold", (totalIn - totalOut) >= 0 ? "text-emerald-600" : "text-red-500")}>
              {(totalIn - totalOut) >= 0 ? "+" : ""}{(totalIn - totalOut).toLocaleString("en-IN")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-1 mb-4">
        {TYPE_FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={type === f.value || (!type && f.value === "") ? "secondary" : "ghost"}
            size="sm"
            className="h-8 text-xs"
            asChild
          >
            <Link href={f.value ? `/inventory/history?type=${f.value}` : "/inventory/history"}>
              {f.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No stock movements found.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => {
                const config = TYPE_CONFIG[txn.type] ?? TYPE_CONFIG.adjustment
                const Icon = config.icon
                return (
                  <TableRow key={txn.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      <span className="font-medium">{formatDate(txn.created_at)}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">{formatDateRelative(txn.created_at)}</span>
                    </TableCell>
                    <TableCell>
                      {txn.material ? (
                        <Link
                          href={`/inventory/${txn.material_id}`}
                          className="font-medium text-primary underline-offset-4 hover:underline text-sm"
                        >
                          {txn.material.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {txn.material?.sku ?? "--"}
                    </TableCell>
                    <TableCell>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", config.bg, config.color)}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums font-semibold", txn.quantity > 0 ? "text-emerald-600" : "text-red-500")}>
                      {txn.quantity > 0 ? "+" : ""}{txn.quantity} {txn.material?.unit ?? ""}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {txn.notes ?? "--"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  )
}

"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"

import { formatDate } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Dispatch {
  id: string
  brand: string
  item_name: string
  quantity: number
  bill_no: string
  dispatched_at: string
  notes: string | null
  warehouse_item: { sku: string | null } | null
  order: { order_number: string } | null
}

export function WarehouseDispatchesList({ dispatches }: { dispatches: Dispatch[] }) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return dispatches
    return dispatches.filter((d) =>
      [d.brand, d.item_name, d.bill_no, d.warehouse_item?.sku, d.order?.order_number]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q))
    )
  }, [dispatches, search])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search brand, item, SKU, invoice, order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Item Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Order #</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Invoice Number</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                  No dispatches found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{d.brand}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{d.item_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {d.warehouse_item?.sku ?? "--"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{d.order?.order_number ?? "Unlinked"}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.quantity}</TableCell>
                  <TableCell className="font-mono text-xs">{d.bill_no}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.dispatched_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

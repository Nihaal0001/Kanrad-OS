"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Send } from "lucide-react"

import { pushToLogistics } from "@/actions/warehouse"
import { formatDate, friendlyError } from "@/lib/utils"
import { formatCartons } from "@/lib/master-cartons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface WarehouseItem {
  id: string
  item_name: string
  sku: string | null
  category: string | null
  quantity: number
  unit: string
  location: string | null
  status: string
  entry_date: string
  exit_date: string | null
  remarks: string | null
  created_at: string
  master_cartons: number | null
  order_id: string | null
}

interface WarehouseTableProps {
  items: WarehouseItem[]
  locations: string[]
}

export function WarehouseTable({ items, locations }: WarehouseTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [pushingId, setPushingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = items
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter)
    if (locationFilter !== "all") result = result.filter((i) => i.location === locationFilter)
    return result
  }, [items, statusFilter, locationFilter])

  async function handlePush(id: string) {
    setPushingId(id)
    const result = await pushToLogistics(id)
    setPushingId(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Pushed to Logistics")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_warehouse">In Warehouse</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="ml-auto self-center text-sm text-muted-foreground">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No items found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Master Cartons</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entry Date</TableHead>
                <TableHead>Exit Date</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-[140px]">
                  <span className="sr-only">Logistics</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.sku ?? "--"}
                  </TableCell>
                  <TableCell>{item.category ?? "--"}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.master_cartons != null ? formatCartons(item.master_cartons) : "--"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                  <TableCell>{item.location ?? "--"}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(item.entry_date)}</TableCell>
                  <TableCell className="text-sm">
                    {item.exit_date ? formatDate(item.exit_date) : <span className="text-muted-foreground">--</span>}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-sm text-muted-foreground">
                    {item.remarks ?? "--"}
                  </TableCell>
                  <TableCell>
                    {item.status === "in_warehouse" && (
                      item.order_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          disabled={pushingId === item.id}
                          onClick={() => handlePush(item.id)}
                        >
                          <Send className="h-3 w-3" />
                          {pushingId === item.id ? "Pushing…" : "Push to Logistics"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No linked order</span>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

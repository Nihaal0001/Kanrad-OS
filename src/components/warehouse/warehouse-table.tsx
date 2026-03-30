"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { LogOut } from "lucide-react"

import { exitWarehouseItem, type ExitItemFormData } from "@/actions/warehouse"
import { friendlyError, formatDate } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
}

interface WarehouseTableProps {
  items: WarehouseItem[]
  locations: string[]
}

export function WarehouseTable({ items, locations }: WarehouseTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [exitId, setExitId] = useState<string | null>(null)
  const [exitDate, setExitDate] = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)

  const filtered = useMemo(() => {
    let result = items
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter)
    if (locationFilter !== "all") result = result.filter((i) => i.location === locationFilter)
    return result
  }, [items, statusFilter, locationFilter])

  async function handleExit() {
    if (!exitId) return
    setLoading(true)
    const formData: ExitItemFormData = { exit_date: exitDate }
    const result = await exitWarehouseItem(exitId, formData)
    setLoading(false)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Item marked as dispatched")
    setExitId(null)
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
                <TableHead>Unit</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entry Date</TableHead>
                <TableHead>Exit Date</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-[80px]">
                  <span className="sr-only">Actions</span>
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => {
                          setExitId(item.id)
                          setExitDate(new Date().toISOString().split("T")[0])
                        }}
                      >
                        <LogOut className="h-3 w-3" />
                        Exit
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Exit dialog */}
      <Dialog open={exitId !== null} onOpenChange={(open) => { if (!open) setExitId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Item from Warehouse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="exit_date">Exit Date</Label>
              <Input
                id="exit_date"
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExitId(null)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleExit} disabled={loading}>
                {loading ? "Saving..." : "Confirm Exit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

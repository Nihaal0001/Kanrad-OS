"use client"

import { useState, useMemo, Fragment } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Send, ChevronDown, ChevronRight, PackageOpen } from "lucide-react"

import { dispatchWarehouseSku } from "@/actions/warehouse"
import { formatDate, friendlyError } from "@/lib/utils"
import { formatCartons } from "@/lib/master-cartons"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
  brand: string
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

interface SkuGroup {
  key: string
  sku: string | null
  item_name: string
  category: string | null
  unit: string
  totalQuantity: number
  totalMasterCartons: number | null
  availableQuantity: number
  rows: WarehouseItem[]
}

interface BrandGroup {
  brand: string
  totalQuantity: number
  skus: SkuGroup[]
}

function groupItems(items: WarehouseItem[]): BrandGroup[] {
  const byBrand = new Map<string, Map<string, SkuGroup>>()

  for (const item of items) {
    const skuMap = byBrand.get(item.brand) ?? new Map<string, SkuGroup>()
    byBrand.set(item.brand, skuMap)

    const key = item.sku ?? item.item_name
    const existing = skuMap.get(key)
    if (existing) {
      existing.totalQuantity += item.quantity
      existing.availableQuantity += item.status === "in_warehouse" ? item.quantity : 0
      existing.totalMasterCartons =
        item.master_cartons != null
          ? (existing.totalMasterCartons ?? 0) + item.master_cartons
          : existing.totalMasterCartons
      existing.rows.push(item)
    } else {
      skuMap.set(key, {
        key,
        sku: item.sku,
        item_name: item.item_name,
        category: item.category,
        unit: item.unit,
        totalQuantity: item.quantity,
        totalMasterCartons: item.master_cartons,
        availableQuantity: item.status === "in_warehouse" ? item.quantity : 0,
        rows: [item],
      })
    }
  }

  return [...byBrand.entries()]
    .map(([brand, skuMap]) => {
      const skus = [...skuMap.values()].sort((a, b) => a.item_name.localeCompare(b.item_name))
      return {
        brand,
        totalQuantity: skus.reduce((s, g) => s + g.totalQuantity, 0),
        skus,
      }
    })
    .sort((a, b) => a.brand.localeCompare(b.brand))
}

export function WarehouseTable({ items, locations }: WarehouseTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [dispatchGroup, setDispatchGroup] = useState<SkuGroup | null>(null)
  const [dispatchQty, setDispatchQty] = useState("")
  const [dispatchBillNo, setDispatchBillNo] = useState("")
  const [dispatchNotes, setDispatchNotes] = useState("")
  const [dispatching, setDispatching] = useState(false)

  const filtered = useMemo(() => {
    let result = items
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter)
    if (locationFilter !== "all") result = result.filter((i) => i.location === locationFilter)
    return result
  }, [items, statusFilter, locationFilter])

  const brandGroups = useMemo(() => groupItems(filtered), [filtered])

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function openDispatch(group: SkuGroup) {
    setDispatchGroup(group)
    setDispatchQty("")
    setDispatchBillNo("")
    setDispatchNotes("")
  }

  async function handleDispatch() {
    if (!dispatchGroup || !dispatchGroup.sku) return
    const qty = Number(dispatchQty)
    if (!dispatchQty || isNaN(qty) || qty <= 0) {
      toast.error("Enter a valid quantity to dispatch")
      return
    }
    if (qty > dispatchGroup.availableQuantity) {
      toast.error(`Cannot dispatch more than ${dispatchGroup.availableQuantity} available`)
      return
    }
    if (!dispatchBillNo.trim()) {
      toast.error("Enter the bill number")
      return
    }

    setDispatching(true)
    const result = await dispatchWarehouseSku({
      sku: dispatchGroup.sku,
      quantity: qty,
      bill_no: dispatchBillNo.trim(),
      notes: dispatchNotes,
    })
    setDispatching(false)

    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success(`Dispatched ${qty} ${dispatchGroup.unit} of ${dispatchGroup.item_name}`)
    setDispatchGroup(null)
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

      {/* Brand groups */}
      {brandGroups.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No items found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {brandGroups.map((bg) => (
            <div key={bg.brand} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <PackageOpen className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{bg.brand}</h3>
                <Badge variant="secondary" className="text-xs">{bg.skus.length} SKU{bg.skus.length !== 1 ? "s" : ""}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  {bg.totalQuantity.toLocaleString("en-IN")} units total
                </span>
              </div>

              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Total Qty</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Master Cartons</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="w-[140px]">
                        <span className="sr-only">Dispatch</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bg.skus.map((g) => {
                      const isOpen = expanded.has(`${bg.brand}|${g.key}`)
                      return (
                        <Fragment key={g.key}>
                          <TableRow
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => toggle(`${bg.brand}|${g.key}`)}
                          >
                            <TableCell>
                              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="font-medium">{g.item_name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{g.sku ?? "--"}</TableCell>
                            <TableCell>{g.category ?? "--"}</TableCell>
                            <TableCell className="text-right tabular-nums">{g.totalQuantity}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{g.availableQuantity}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {g.totalMasterCartons != null ? formatCartons(g.totalMasterCartons) : "--"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{g.unit}</TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              {g.sku && g.availableQuantity > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => openDispatch(g)}
                                >
                                  <Send className="h-3 w-3" />
                                  Dispatch
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {isOpen && (
                            <TableRow key={`${g.key}-detail`} className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={9} className="p-0">
                                <div className="px-8 py-3">
                                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    By order / batch
                                  </p>
                                  <div className="space-y-1.5">
                                    {g.rows.map((row) => (
                                      <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <StatusBadge status={row.status} />
                                          <span className="text-muted-foreground">{row.location ?? "No location"}</span>
                                          <span className="tabular-nums font-medium">{row.quantity} {row.unit}</span>
                                          <span className="text-xs text-muted-foreground">{formatDate(row.entry_date)}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch dialog */}
      <Dialog open={!!dispatchGroup} onOpenChange={(open) => !open && setDispatchGroup(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Dispatch {dispatchGroup?.item_name}</DialogTitle>
          </DialogHeader>
          {dispatchGroup && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-mono">{dispatchGroup.sku}</p>
              <div className="space-y-1.5">
                <Label>Quantity to Dispatch ({dispatchGroup.unit})</Label>
                <Input
                  type="number"
                  min={0.01}
                  max={dispatchGroup.availableQuantity}
                  step="0.01"
                  placeholder={`Max ${dispatchGroup.availableQuantity}`}
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {dispatchGroup.availableQuantity} {dispatchGroup.unit} available
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Bill No. *</Label>
                <Input
                  value={dispatchBillNo}
                  onChange={(e) => setDispatchBillNo(e.target.value)}
                  placeholder="e.g. INV-1042"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Input
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="Transporter, destination, etc."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispatchGroup(null)} disabled={dispatching}>
              Cancel
            </Button>
            <Button onClick={handleDispatch} disabled={dispatching}>
              {dispatching ? "Dispatching…" : "Dispatch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

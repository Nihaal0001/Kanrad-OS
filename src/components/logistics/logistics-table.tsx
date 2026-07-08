"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"

import { updateShipmentStatus, markShipmentDelayed } from "@/actions/logistics"
import { friendlyError, formatDate, formatCurrency } from "@/lib/utils"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Shipment {
  id: string
  shipment_number: string | null
  order: { id: string; order_number: string; product_variant: string | null } | null
  customer_name: string | null
  customer_contact: string | null
  courier_name: string | null
  tracking_number: string | null
  status: string
  expected_delivery_date: string | null
  created_at: string
  bill_no: string | null
  quantity: number | null
  master_cartons: number | null
  value: number | null
}

interface LogisticsTableProps {
  shipments: Shipment[]
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["dispatched"],
  dispatched: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
  delayed: ["in_transit", "delivered"],
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  delivered: "Delivered",
  delayed: "Delayed",
}

export function LogisticsTable({ shipments }: LogisticsTableProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState("all")
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (statusFilter === "all") return shipments
    return shipments.filter((s) => s.status === statusFilter)
  }, [shipments, statusFilter])

  async function handleStatusChange(id: string, status: string) {
    setLoadingId(id)
    const result = await updateShipmentStatus(id, status)
    setLoadingId(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success(`Status updated to ${STATUS_LABELS[status] ?? status}`)
    router.refresh()
  }

  async function handleMarkDelayed(id: string) {
    setLoadingId(id)
    const result = await markShipmentDelayed(id)
    setLoadingId(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Shipment marked as delayed")
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="dispatched">Dispatched</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="delayed">Delayed</SelectItem>
          </SelectContent>
        </Select>

        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length} shipment{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No shipments found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment ID</TableHead>
                <TableHead>Order Ref</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Bill No.</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">MC</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Tracking #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[120px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((shipment) => {
                const nextStatuses = STATUS_TRANSITIONS[shipment.status] ?? []
                const isLoading = loadingId === shipment.id

                return (
                  <TableRow key={shipment.id}>
                    <TableCell className="font-mono text-xs">
                      {shipment.shipment_number ?? "--"}
                    </TableCell>
                    <TableCell>
                      {shipment.order ? (
                        <span className="text-sm">
                          {shipment.order.order_number}
                          {shipment.order.product_variant && (
                            <span className="ml-1 text-muted-foreground">
                              ({shipment.order.product_variant})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>{shipment.customer_name ?? "--"}</TableCell>
                    <TableCell className="font-mono text-xs">{shipment.bill_no ?? "--"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{shipment.customer_contact ?? "--"}</TableCell>
                    <TableCell className="text-right tabular-nums">{shipment.quantity ?? "--"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {shipment.master_cartons != null ? formatCartons(shipment.master_cartons) : "--"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {shipment.value != null ? formatCurrency(shipment.value) : "--"}
                    </TableCell>
                    <TableCell>{shipment.courier_name ?? "--"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {shipment.tracking_number ?? "--"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={shipment.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.expected_delivery_date
                        ? formatDate(shipment.expected_delivery_date)
                        : <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(shipment.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {nextStatuses.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={isLoading}>
                                Update
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {nextStatuses.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => handleStatusChange(shipment.id, s)}>
                                  {STATUS_LABELS[s] ?? s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {shipment.status !== "delivered" && shipment.status !== "delayed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-orange-600 hover:text-orange-700"
                            disabled={isLoading}
                            onClick={() => handleMarkDelayed(shipment.id)}
                          >
                            <AlertCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

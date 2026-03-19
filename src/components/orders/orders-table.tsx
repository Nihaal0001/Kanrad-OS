"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Search, Eye, Pencil, Trash2 } from "lucide-react"

import type { OrderWithCustomer } from "@/lib/supabase/types"
import { cn, formatDate, friendlyError, isOverdue } from "@/lib/utils"
import { deleteOrder } from "@/actions/orders"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_production", label: "In Production" },
  { value: "completed", label: "Completed" },
  { value: "dispatched", label: "Dispatched" },
] as const

interface OrdersTableProps {
  orders: OrderWithCustomer[]
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filteredOrders = useMemo(() => {
    let result = orders

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          o.style_name.toLowerCase().includes(q) ||
          o.customer?.name.toLowerCase().includes(q)
      )
    }

    return result
  }, [orders, statusFilter, search])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const result = await deleteOrder(id)
      setDeletingId(null)
      setConfirmId(null)

      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }

      toast.success("Order deleted")
      router.refresh()
    },
    [router]
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_FILTERS.map((sf) => (
          <Button
            key={sf.value}
            variant={statusFilter === sf.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setStatusFilter(sf.value)}
            className={cn(
              "h-8 text-xs",
              statusFilter === sf.value && "font-semibold"
            )}
          >
            {sf.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No orders found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Styles</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{order.style_name}</TableCell>
                  <TableCell>
                    {order.customer ? (
                      <span>
                        {order.customer.name}
                        {order.customer.company && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({order.customer.company})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {order.total_quantity.toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className={cn(
                    "whitespace-nowrap",
                    !["completed", "dispatched", "cancelled"].includes(order.status) && isOverdue(order.deadline) && "text-destructive font-medium"
                  )}>
                    {!["completed", "dispatched", "cancelled"].includes(order.status) && isOverdue(order.deadline) && "Overdue · "}
                    {formatDate(order.deadline)}
                  </TableCell>
                  <TableCell>
                    <PriorityIndicator
                      priority={order.priority}
                      showLabel
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deletingId === order.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/orders/${order.id}`}>
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/orders/${order.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        {(order.status === "draft" || order.status === "cancelled") && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmId(order.id)}
                              disabled={deletingId === order.id}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => { if (!open) setConfirmId(null) }}
        title="Delete Order"
        description="Delete this order permanently? Only draft and cancelled orders can be deleted."
        confirmLabel="Delete"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        loading={deletingId !== null}
      />
    </div>
  )
}

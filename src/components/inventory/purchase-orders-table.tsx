"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Search, Eye, Trash2, CheckCircle2, Clock, XCircle } from "lucide-react"

import type { PurchaseOrder } from "@/lib/supabase/types"
import { cn, formatCurrency, formatDate, friendlyError } from "@/lib/utils"
import { deletePurchaseOrder } from "@/actions/inventory"
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

const APPROVAL_BADGE: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending_approval: { label: "Pending Approval", icon: Clock, className: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  approved: { label: "Approved", icon: CheckCircle2, className: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  rejected: { label: "Rejected", icon: XCircle, className: "text-red-600 bg-red-500/10 border-red-500/20" },
}

function ApprovalBadge({ status }: { status: string }) {
  const config = APPROVAL_BADGE[status] ?? APPROVAL_BADGE.pending_approval
  const Icon = config.icon
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
] as const

interface PurchaseOrdersTableProps {
  purchaseOrders: PurchaseOrder[]
}

export function PurchaseOrdersTable({ purchaseOrders }: PurchaseOrdersTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let result = purchaseOrders

    if (statusFilter !== "all") {
      result = result.filter((po) => po.status === statusFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (po) =>
          po.po_number.toLowerCase().includes(q) ||
          po.supplier_name.toLowerCase().includes(q)
      )
    }

    return result
  }, [purchaseOrders, statusFilter, search])

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const result = await deletePurchaseOrder(id)
      setDeletingId(null)
      setConfirmId(null)

      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }

      toast.success("Purchase order deleted")
      router.refresh()
    },
    [router]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search purchase orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {filtered.length} PO{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

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

      {filtered.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No purchase orders found.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/inventory/purchase-orders/${po.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {po.po_number}
                    </Link>
                  </TableCell>
                  <TableCell>{po.supplier_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(po.order_date)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {po.expected_date ? formatDate(po.expected_date) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(po.total_amount)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={po.status} />
                  </TableCell>
                  <TableCell>
                    <ApprovalBadge status={po.approval_status ?? "pending_approval"} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deletingId === po.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/inventory/purchase-orders/${po.id}`}>
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmId(po.id)}
                          disabled={deletingId === po.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
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
        title="Delete Purchase Order"
        description="Are you sure you want to delete this purchase order? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        loading={deletingId !== null}
      />
    </div>
  )
}

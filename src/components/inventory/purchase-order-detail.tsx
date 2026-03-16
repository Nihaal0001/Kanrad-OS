"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"

import {
  updatePurchaseOrderStatus,
  receivePurchaseOrderItem,
} from "@/actions/inventory"
import { formatCurrency, formatDate, friendlyError } from "@/lib/utils"
import { toast } from "sonner"
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
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/status-badge"
import { POApprovalButtons } from "@/components/inventory/po-approval-buttons"

interface POItem {
  id: string
  material_id: string
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  material: { id: string; name: string; sku: string; unit: string } | null
}

interface PurchaseOrderDetailProps {
  po: {
    id: string
    po_number: string
    supplier_name: string
    supplier_contact: string | null
    status: string
    approval_status: string
    approval_notes: string | null
    order_date: string
    expected_date: string | null
    total_amount: number
    notes: string | null
    items: POItem[]
  }
}

export function PurchaseOrderDetail({ po: initialPo }: PurchaseOrderDetailProps) {
  const router = useRouter()
  const [po, setPo] = useState(initialPo)
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>(
    () => {
      const quantities: Record<string, number> = {}
      initialPo.items?.forEach((item) => {
        quantities[item.id] = item.quantity_ordered - item.quantity_received
      })
      return quantities
    }
  )

  const handleStatusChange = useCallback(
    async (status: string) => {
      const result = await updatePurchaseOrderStatus(po.id, status)
      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }
      toast.success("Status updated")
      setPo((prev) => ({ ...prev, status }))
      router.refresh()
    },
    [po.id, router]
  )

  const handleReceiveItem = useCallback(
    async (itemId: string) => {
      setReceivingItemId(itemId)
      const qty = receiveQuantities[itemId] ?? 0

      const result = await receivePurchaseOrderItem(itemId, qty, po.id)
      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        setReceivingItemId(null)
        return
      }

      // Update local state
      setPo((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId
            ? { ...item, quantity_received: item.quantity_received + qty }
            : item
        ),
      }))

      setReceivingItemId(null)
      router.refresh()
    },
    [po.id, receiveQuantities, router]
  )

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {/* Status actions */}
        {(po.status === "draft" ||
          po.status === "sent" ||
          po.status === "partial") && (
          <div className="flex gap-2">
            {po.status === "draft" && (
              <Button onClick={() => handleStatusChange("sent")}>
                Mark as Sent
              </Button>
            )}
            {(po.status === "sent" || po.status === "partial") && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange("cancelled")}
              >
                Cancel PO
              </Button>
            )}
          </div>
        )}

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
            <CardDescription>
              Materials ordered and receiving status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    {(po.status === "sent" || po.status === "partial") && (
                      <TableHead>Receive</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.material?.name ?? "Unknown"}
                        <br />
                        <span className="text-xs text-muted-foreground font-mono">
                          {item.material?.sku}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity_ordered}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity_received}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(item.quantity_ordered * item.unit_price)}
                      </TableCell>
                      {(po.status === "sent" || po.status === "partial") && (
                        <TableCell>
                          {item.quantity_received < item.quantity_ordered ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={
                                  item.quantity_ordered - item.quantity_received
                                }
                                className="w-20 h-8"
                                value={receiveQuantities[item.id] ?? 0}
                                onChange={(e) =>
                                  setReceiveQuantities((prev) => ({
                                    ...prev,
                                    [item.id]: Number(e.target.value),
                                  }))
                                }
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={receivingItemId === item.id}
                                onClick={() => handleReceiveItem(item.id)}
                              >
                                {receivingItemId === item.id ? "..." : "Receive"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">
                              Fully received
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge status={po.status} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Approval</p>
              <POApprovalButtons poId={po.id} approvalStatus={po.approval_status ?? "pending_approval"} />
              {po.approval_status === "approved" && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">✓ Approved</span>
              )}
              {po.approval_status === "rejected" && (
                <div>
                  <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">✕ Rejected</span>
                  {po.approval_notes && <p className="text-xs text-muted-foreground mt-0.5">{po.approval_notes}</p>}
                </div>
              )}
              {po.approval_status === "pending_approval" && (
                <p className="text-xs text-muted-foreground">Awaiting admin approval</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Order Date</p>
              <p className="font-medium">{formatDate(po.order_date)}</p>
            </div>
            {po.expected_date && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Expected Delivery
                </p>
                <p className="font-medium">{formatDate(po.expected_date)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">
                {formatCurrency(po.total_amount)}
              </p>
            </div>
            {po.supplier_contact && (
              <div>
                <p className="text-sm text-muted-foreground">
                  Supplier Contact
                </p>
                <p className="font-medium">{po.supplier_contact}</p>
              </div>
            )}
            {po.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{po.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

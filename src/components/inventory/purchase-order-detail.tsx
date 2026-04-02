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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/shared/status-badge"
import { POApprovalButtons } from "@/components/inventory/po-approval-buttons"
import { CheckCircle2, Package, Clock, TruckIcon } from "lucide-react"
import { kgToPieces } from "@/lib/circle-calc"

interface POItem {
  id: string
  material_id: string
  quantity_ordered: number
  quantity_received: number
  unit_price: number
  material: {
    id: string
    name: string
    sku: string
    unit: string
    diameter_mm: number | null
    thickness_mm: number | null
    circle_type: string | null
  } | null
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

function ReceiptProgressBar({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className={pct === 100 ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
          {received} received
        </span>
        <span className={pct < 100 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
          {ordered - received} pending
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5 text-right">{pct}% of {ordered}</p>
    </div>
  )
}

export function PurchaseOrderDetail({ po: initialPo }: PurchaseOrderDetailProps) {
  const router = useRouter()
  const [po, setPo] = useState(initialPo)
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null)
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>(
    () => Object.fromEntries((initialPo.items ?? []).map((item) => [item.id, ""]))
  )

  const canReceive = po.status === "sent" || po.status === "partial"

  const totalOrdered = (po.items ?? []).reduce((s, i) => s + i.quantity_ordered, 0)
  const totalReceived = (po.items ?? []).reduce((s, i) => s + i.quantity_received, 0)
  const totalPending = totalOrdered - totalReceived
  const overallPct = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0

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
    async (itemId: string, item: POItem) => {
      const raw = receiveQuantities[itemId]
      const qty = Number(raw)
      if (!raw || isNaN(qty) || qty <= 0) {
        toast.error("Enter a valid quantity to receive")
        return
      }
      const maxQty = item.quantity_ordered - item.quantity_received
      if (qty > maxQty) {
        toast.error(`Cannot receive more than ${maxQty} (pending quantity)`)
        return
      }

      setReceivingItemId(itemId)
      const result = await receivePurchaseOrderItem(itemId, item.quantity_received + qty, po.id)
      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        setReceivingItemId(null)
        return
      }

      setPo((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? { ...i, quantity_received: i.quantity_received + qty }
            : i
        ),
      }))
      setReceiveQuantities((prev) => ({ ...prev, [itemId]: "" }))
      toast.success(`Received ${qty} ${item.material?.unit ?? "units"}`)
      setReceivingItemId(null)
      router.refresh()
    },
    [po.id, receiveQuantities, router]
  )

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
      <div className="space-y-4 sm:space-y-6 lg:col-span-2">

        {/* Overall receipt progress */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Overall Receipt Progress</p>
              <span className="text-xs text-muted-foreground">{overallPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overallPct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-1">
              {[
                { label: "Total Lines", value: po.items?.length ?? 0, icon: Package, color: "" },
                { label: "Received", value: totalReceived, icon: CheckCircle2, color: "text-emerald-600" },
                { label: "Pending", value: totalPending, icon: Clock, color: totalPending > 0 ? "text-amber-600" : "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-lg border py-3">
                  <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Status actions */}
        {(po.status === "draft" || po.status === "sent" || po.status === "partial") && (
          <div className="flex gap-2">
            {po.status === "draft" && (
              <Button onClick={() => handleStatusChange("sent")}>
                <TruckIcon className="h-4 w-4" />
                Mark as Sent to Supplier
              </Button>
            )}
            {(po.status === "sent" || po.status === "partial") && (
              <Button variant="outline" onClick={() => handleStatusChange("cancelled")}>
                Cancel PO
              </Button>
            )}
          </div>
        )}

        {/* Line items */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Line Items</h3>
          {(po.items ?? []).map((item) => {
            const pending = item.quantity_ordered - item.quantity_received
            const fullyReceived = pending <= 0
            return (
              <Card key={item.id} className={fullyReceived ? "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10" : ""}>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.material?.name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.material?.sku} · ₹{formatCurrency(item.unit_price)}/{item.material?.unit ?? "unit"}</p>
                    </div>
                    {fullyReceived && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Complete
                      </span>
                    )}
                  </div>

                  <ReceiptProgressBar received={item.quantity_received} ordered={item.quantity_ordered} />
                  {item.material?.circle_type === "non_ib" &&
                    item.material.diameter_mm != null &&
                    item.material.thickness_mm != null &&
                    item.quantity_received > 0 && (() => {
                      const pcs = kgToPieces(item.quantity_received, item.material.diameter_mm!, item.material.thickness_mm!, "non_ib")
                      return pcs ? (
                        <p className="text-xs text-muted-foreground">
                          Received: <span className="font-semibold text-foreground">{pcs.toLocaleString("en-IN")} pcs</span>
                          {" "}from {item.quantity_received} kg
                        </p>
                      ) : null
                    })()
                  }

                  {canReceive && !fullyReceived && (() => {
                    const mat = item.material
                    const isNonIbCircle =
                      mat?.circle_type === "non_ib" &&
                      mat.diameter_mm != null &&
                      mat.thickness_mm != null
                    const enteredKg = Number(receiveQuantities[item.id] ?? "")
                    const pcsPreview =
                      isNonIbCircle && enteredKg > 0 && mat?.diameter_mm && mat?.thickness_mm
                        ? kgToPieces(enteredKg, mat.diameter_mm, mat.thickness_mm, "non_ib")
                        : null

                    return (
                      <div className="flex items-end gap-2 pt-1">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Receiving today ({item.material?.unit ?? "units"})
                          </Label>
                          <Input
                            type="number"
                            min={0.01}
                            max={pending}
                            step="0.01"
                            placeholder={`Max ${pending}`}
                            value={receiveQuantities[item.id] ?? ""}
                            onChange={(e) =>
                              setReceiveQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-9"
                          />
                          {pcsPreview != null && (
                            <p className="text-xs font-semibold text-primary">
                              ≈ {pcsPreview.toLocaleString("en-IN")} pcs
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="h-9"
                          disabled={receivingItemId === item.id || !receiveQuantities[item.id]}
                          onClick={() => handleReceiveItem(item.id, item)}
                        >
                          {receivingItemId === item.id ? "Saving…" : "Receive"}
                        </Button>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1"><StatusBadge status={po.status} /></div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Approval</p>
              <POApprovalButtons poId={po.id} approvalStatus={po.approval_status ?? "pending_approval"} />
              {po.approval_status === "approved" && (
                <span className="text-xs text-emerald-600 font-medium">✓ Approved</span>
              )}
              {po.approval_status === "rejected" && (
                <div>
                  <span className="text-xs text-red-600 font-medium">✕ Rejected</span>
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
                <p className="text-sm text-muted-foreground">Expected Delivery</p>
                <p className="font-medium">{formatDate(po.expected_date)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(po.total_amount)}</p>
            </div>
            {po.supplier_contact && (
              <div>
                <p className="text-sm text-muted-foreground">Supplier Contact</p>
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

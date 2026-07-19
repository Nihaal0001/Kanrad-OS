"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { toast } from "sonner"
import { updateOrderStatus, deleteOrder, duplicateOrder } from "@/actions/orders"
import type { OrderDetail } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Copy, FileDown, Printer, Trash2, Calculator } from "lucide-react"
import Link from "next/link"

const statusTransitions: Record<string, { label: string; status: string }[]> = {
  draft: [{ label: "Confirm Order", status: "confirmed" }],
  confirmed: [{ label: "Start Production", status: "in_production" }],
  in_production: [{ label: "Mark Complete", status: "completed" }],
  completed: [{ label: "Mark Dispatched", status: "dispatched" }],
  dispatched: [],
  cancelled: [],
}

interface OrderActionsProps {
  order: OrderDetail
  /** Whether costing (order_costings row) has been done for this order — required before it can leave draft. */
  hasCosting: boolean
}

export function OrderActions({ order, hasCosting }: OrderActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const transitions = statusTransitions[order.status] ?? []

  function handleStatusChange(status: string) {
    setError(null)
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, status)
      if (result && "error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Order status updated")
        router.refresh()
      }
    })
  }

  function handleDuplicate() {
    startTransition(async () => {
      const result = await duplicateOrder(order.id)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
      } else if (result && "data" in result && result.data) {
        toast.success("Order duplicated")
        router.push(`/orders/${result.data.id}`)
      }
    })
  }

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteOrder(order.id)
      if (result && "error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success("Order deleted")
        router.push("/orders")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {transitions.map((t) =>
          t.status === "confirmed" && !hasCosting ? (
            <Button key={t.status} className="w-full" variant="outline" asChild>
              <Link href={`/finance/costing/${order.id}`}>
                <Calculator className="mr-2 h-4 w-4" />
                Do Costing First
              </Link>
            </Button>
          ) : (
            <Button
              key={t.status}
              className="w-full"
              disabled={isPending}
              onClick={() => handleStatusChange(t.status)}
            >
              {t.label}
            </Button>
          )
        )}

        {order.status !== "cancelled" && order.status !== "dispatched" && (
          <Button
            variant="outline"
            className="w-full"
            disabled={isPending}
            onClick={() => handleStatusChange("cancelled")}
          >
            Cancel Order
          </Button>
        )}

        <Button
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={handleDuplicate}
        >
          <Copy className="mr-2 h-4 w-4" />
          Duplicate Order
        </Button>

        {(order.status === "dispatched" || order.status === "completed") && (
          <>
            <a href={`/api/challan/${order.id}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <FileDown className="mr-2 h-4 w-4" />
                Download Challan
              </Button>
            </a>
            <a href={`/api/packing-slip/${order.id}/pdf`} target="_blank" rel="noreferrer">
              <Button variant="outline" className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                Print Packing Slip
              </Button>
            </a>
          </>
        )}

        {(order.status === "draft" || order.status === "cancelled") && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full"
              disabled={isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete order{" "}
                <strong>{order.order_number}</strong>? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </CardContent>
    </Card>
  )
}

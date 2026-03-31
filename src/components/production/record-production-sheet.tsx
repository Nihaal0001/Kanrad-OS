"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import { startProductionBatch } from "@/actions/production"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface OrderOption {
  id: string
  order_number: string
  product_variant: string
  total_quantity: number
  status: string
  customer: { id: string; name: string } | null
}

interface Props {
  orders: OrderOption[]
}

const DAILY_TARGET_OPTIONS = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500]

export function RecordProductionSheet({ orders }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [productId, setProductId] = useState("")
  const [plannedQty, setPlannedQty] = useState("")
  const [dailyTarget, setDailyTarget] = useState("")
  const [startDate, setStartDate] = useState("")

  function handleOpen() {
    setSelectedOrderId("")
    setProductId("")
    setPlannedQty("")
    setDailyTarget("")
    setStartDate(new Date().toISOString().split("T")[0])
    setOpen(true)
  }

  function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId)
    const order = orders.find((o) => o.id === orderId)
    if (order) {
      setProductId(order.product_variant)
      setPlannedQty(String(order.total_quantity))
    } else {
      setProductId("")
      setPlannedQty("")
    }
  }

  function handleSubmit() {
    if (!selectedOrderId) { toast.error("Select an order"); return }
    const qty = Number(plannedQty)
    if (!plannedQty || isNaN(qty) || qty <= 0) { toast.error("Enter a valid planned quantity"); return }
    if (!startDate) { toast.error("Select a planned start date"); return }

    startTransition(async () => {
      const result = await startProductionBatch(
        selectedOrderId,
        qty,
        startDate,
        dailyTarget ? Number(dailyTarget) : undefined
      )
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Production batch created")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        Create Batch
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md w-full p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-center text-lg font-semibold">Create Production Batch</DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[70vh]">

            {/* Order */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Order *</Label>
              <Select value={selectedOrderId} onValueChange={handleOrderChange}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select an order" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      <span className="font-mono text-xs mr-2">{o.order_number}</span>
                      {o.product_variant}
                      {o.customer && <span className="text-muted-foreground ml-1.5">· {o.customer.name}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Product ID */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Product ID</Label>
              <Input
                className="h-12 text-base bg-muted/40"
                value={productId}
                readOnly
                disabled
                placeholder=""
              />
              <p className="text-sm text-muted-foreground">Auto-filled from order</p>
            </div>

            {/* Planned Quantity */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Planned Quantity</Label>
              <Input
                className="h-12 text-base"
                type="number"
                min={1}
                value={plannedQty}
                onChange={(e) => setPlannedQty(e.target.value)}
                placeholder=""
              />
              <p className="text-sm text-muted-foreground">Auto-filled from order quantity (can be adjusted)</p>
            </div>

            {/* Daily Target */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Daily Target</Label>
              <Select value={dailyTarget} onValueChange={setDailyTarget}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select daily target (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {DAILY_TARGET_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} units/day</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Set a daily production target to track progress</p>
            </div>

            {/* Planned Start Date */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Planned Start Date</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 border-t">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleSubmit}
              disabled={isPending || !selectedOrderId}
            >
              {isPending ? "Creating…" : "Create Batch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

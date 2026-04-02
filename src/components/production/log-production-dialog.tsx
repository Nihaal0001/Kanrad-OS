"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ClipboardList } from "lucide-react"
import { toast } from "sonner"

import { logDailyProduction } from "@/actions/production"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  customer: { id: string; name: string } | null
}

interface Props {
  orders: OrderOption[]
  // When used on the detail page, pre-select an order
  preselectedOrderId?: string
  preselectedTotalQty?: number
}

export function LogProductionDialog({ orders, preselectedOrderId, preselectedTotalQty }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split("T")[0]
  const [selectedOrderId, setSelectedOrderId] = useState(preselectedOrderId ?? "")
  const [logDate, setLogDate] = useState(today)
  const [qty, setQty] = useState("")
  const [rejected, setRejected] = useState("0")
  const [notes, setNotes] = useState("")

  const selectedOrder = orders.find((o) => o.id === selectedOrderId)

  function handleOpen() {
    setSelectedOrderId(preselectedOrderId ?? "")
    setLogDate(today)
    setQty("")
    setRejected("0")
    setNotes("")
    setOpen(true)
  }

  function handleSubmit() {
    if (!selectedOrderId) { toast.error("Select an order"); return }
    const produced = Number(qty)
    const rej = Number(rejected)
    if (!qty || isNaN(produced) || produced <= 0) { toast.error("Enter quantity produced"); return }
    if (isNaN(rej) || rej < 0) { toast.error("Enter valid rejected quantity"); return }
    if (rej > produced) { toast.error("Rejected can't exceed produced"); return }

    startTransition(async () => {
      const result = await logDailyProduction({
        order_id: selectedOrderId,
        log_date: logDate,
        quantity_produced: produced,
        quantity_rejected: rej,
        notes: notes.trim() || undefined,
      })
      if (result && "error" in result) { toast.error(result.error); return }
      toast.success("Production logged")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={handleOpen} variant="outline">
        <ClipboardList className="h-4 w-4" />
        Log Production
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm w-full p-0 gap-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-center text-lg font-semibold">Log Production</DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">

            {/* Order selector — only shown when not preselected */}
            {!preselectedOrderId && (
              <div className="space-y-1.5">
                <Label className="text-base font-semibold">Order *</Label>
                <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
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
            )}

            {/* Order summary banner */}
            {selectedOrder && (
              <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
                <p className="font-semibold">{selectedOrder.product_variant}</p>
                <p className="text-muted-foreground text-xs">{selectedOrder.order_number} · {selectedOrder.total_quantity.toLocaleString("en-IN")} pcs total</p>
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Date</Label>
              <Input
                type="date"
                className="h-12 text-base"
                value={logDate}
                max={today}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>

            {/* Qty produced */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Quantity Produced (pcs) *</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  className="h-12 text-base pr-12"
                  placeholder="e.g. 150"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">pcs</span>
              </div>
            </div>

            {/* Qty rejected */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Rejected / Defective (pcs)</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  className="h-12 text-base pr-12"
                  placeholder="0"
                  value={rejected}
                  onChange={(e) => setRejected(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">pcs</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                className="h-12 text-base"
                placeholder="Any issues, delays, remarks…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 border-t">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleSubmit}
              disabled={isPending || !selectedOrderId}
            >
              {isPending ? "Saving…" : "Save Log"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

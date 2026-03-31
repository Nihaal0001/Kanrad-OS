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

interface Props {
  orderId: string
  orderNumber: string
  totalQuantity: number
  totalProducedSoFar: number
}

export function LogProductionDialog({ orderId, orderNumber, totalQuantity, totalProducedSoFar }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split("T")[0]
  const [logDate, setLogDate] = useState(today)
  const [qty, setQty] = useState("")
  const [rejected, setRejected] = useState("0")
  const [notes, setNotes] = useState("")

  function handleOpen() {
    setLogDate(today)
    setQty("")
    setRejected("0")
    setNotes("")
    setOpen(true)
  }

  function handleSubmit() {
    const produced = Number(qty)
    const rej = Number(rejected)
    if (!qty || isNaN(produced) || produced <= 0) { toast.error("Enter quantity produced"); return }
    if (isNaN(rej) || rej < 0) { toast.error("Enter valid rejected quantity"); return }
    if (rej > produced) { toast.error("Rejected can't exceed produced"); return }

    startTransition(async () => {
      const result = await logDailyProduction({
        order_id: orderId,
        log_date: logDate,
        quantity_produced: produced,
        quantity_rejected: rej,
        notes: notes.trim() || undefined,
      })
      if (result && "error" in result) {
        toast.error(result.error)
        return
      }
      toast.success("Production logged")
      setOpen(false)
      router.refresh()
    })
  }

  const remaining = Math.max(0, totalQuantity - totalProducedSoFar)

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

            {/* Remaining banner */}
            <div className="rounded-xl bg-muted/50 px-4 py-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Order total</span>
              <span className="font-semibold">{totalQuantity.toLocaleString("en-IN")} pcs</span>
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-semibold text-amber-600">{remaining.toLocaleString("en-IN")} pcs</span>
            </div>

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
              <Label className="text-base font-semibold">Quantity Produced *</Label>
              <Input
                type="number"
                min={1}
                className="h-12 text-base"
                placeholder="e.g. 150"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>

            {/* Qty rejected */}
            <div className="space-y-1.5">
              <Label className="text-base font-semibold">Rejected / Defective</Label>
              <Input
                type="number"
                min={0}
                className="h-12 text-base"
                placeholder="0"
                value={rejected}
                onChange={(e) => setRejected(e.target.value)}
              />
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
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save Log"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

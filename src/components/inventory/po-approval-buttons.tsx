"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/actions/inventory"

interface POApprovalButtonsProps {
  poId: string
  approvalStatus: string
}

export function POApprovalButtons({ poId, approvalStatus }: POApprovalButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [notes, setNotes] = useState("")
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  if (approvalStatus !== "pending_approval") return null

  async function handleApprove() {
    setLoading("approve")
    const result = await approvePurchaseOrder(poId, notes)
    setLoading(null)
    if (result && "error" in result) {
      toast.error(result.error)
      return
    }
    toast.success("Purchase order approved")
    setApproveOpen(false)
    router.refresh()
  }

  async function handleReject() {
    setLoading("reject")
    const result = await rejectPurchaseOrder(poId, notes)
    setLoading(null)
    if (result && "error" in result) {
      toast.error(result.error)
      return
    }
    toast.success("Purchase order rejected")
    setRejectOpen(false)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      {/* Approve */}
      <Dialog open={approveOpen} onOpenChange={(o) => { setApproveOpen(o); if (!o) setNotes("") }}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle2 className="h-4 w-4" />
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any approval notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
              <Button onClick={handleApprove} disabled={loading === "approve"} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading === "approve" ? "Approving..." : "Confirm Approve"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (!o) setNotes("") }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Reason for rejection</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Explain why this PO is being rejected..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button onClick={handleReject} disabled={loading === "reject"} variant="destructive">
                {loading === "reject" ? "Rejecting..." : "Confirm Reject"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

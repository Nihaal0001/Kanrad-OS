"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, X } from "lucide-react"

import { approveReceiptVariance, rejectReceiptVariance } from "@/actions/inventory"
import { Button } from "@/components/ui/button"
import { friendlyError } from "@/lib/utils"

export function ReceiptVarianceApprovalButtons({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)

  async function approve() {
    setLoading("approve")
    const result = await approveReceiptVariance(requestId)
    setLoading(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Quantity approved and stock received")
    router.refresh()
  }

  async function reject() {
    setLoading("reject")
    const result = await rejectReceiptVariance(requestId)
    setLoading(null)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Quantity change rejected")
    router.refresh()
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" onClick={reject} disabled={loading !== null}>
        {loading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        Reject
      </Button>
      <Button size="sm" onClick={approve} disabled={loading !== null}>
        {loading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Approve & receive
      </Button>
    </div>
  )
}

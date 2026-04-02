"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, XCircle, ChevronRight, Loader2 } from "lucide-react"
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

// ── Swipe-to-confirm slider ──────────────────────────────────────────────────
interface SwipeConfirmProps {
  label: string
  color: "green" | "red"
  loading: boolean
  onConfirm: () => void
}

function SwipeConfirm({ label, color, loading, onConfirm }: SwipeConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const startClientX = useRef(0)

  const HANDLE = 44 // px
  const THRESHOLD = 0.72

  function trackWidth() {
    return (trackRef.current?.offsetWidth ?? 240) - HANDLE - 8
  }

  const clamp = (v: number) => Math.max(0, Math.min(v, trackWidth()))

  function onStart(clientX: number) {
    if (loading || triggered) return
    setDragging(true)
    startClientX.current = clientX - x
  }

  const onMove = useCallback(
    (clientX: number) => {
      if (!dragging) return
      setX(clamp(clientX - startClientX.current))
    },
    [dragging] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const onEnd = useCallback(() => {
    if (!dragging) return
    setDragging(false)
    if (x >= trackWidth() * THRESHOLD) {
      setTriggered(true)
      onConfirm()
    } else {
      setX(0)
    }
  }, [dragging, x, onConfirm]) // eslint-disable-line react-hooks/exhaustive-deps

  // Global listeners so fast drags don't lose tracking
  useEffect(() => {
    if (!dragging) return
    const mm = (e: MouseEvent) => onMove(e.clientX)
    const tm = (e: TouchEvent) => onMove(e.touches[0].clientX)
    const mu = () => onEnd()
    window.addEventListener("mousemove", mm)
    window.addEventListener("touchmove", tm, { passive: true })
    window.addEventListener("mouseup", mu)
    window.addEventListener("touchend", mu)
    return () => {
      window.removeEventListener("mousemove", mm)
      window.removeEventListener("touchmove", tm)
      window.removeEventListener("mouseup", mu)
      window.removeEventListener("touchend", mu)
    }
  }, [dragging, onMove, onEnd])

  // Reset when dialog closes (loading resets to false from outside)
  useEffect(() => {
    if (!loading) {
      setX(0)
      setTriggered(false)
    }
  }, [loading])

  const isGreen = color === "green"
  const pct = trackWidth() > 0 ? x / trackWidth() : 0

  return (
    <div
      ref={trackRef}
      className={`relative h-12 rounded-full overflow-hidden select-none ${
        isGreen ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"
      }`}
    >
      {/* Fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${isGreen ? "bg-emerald-200 dark:bg-emerald-800/50" : "bg-red-200 dark:bg-red-800/50"}`}
        style={{ width: `${HANDLE + 8 + x}px`, transition: dragging ? "none" : "width 0.25s ease" }}
      />

      {/* Label */}
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none ${
          isGreen ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        }`}
        style={{ opacity: Math.max(0.35, 1 - pct * 1.4) }}
      >
        {label}
      </span>

      {/* Handle */}
      <div
        className={`absolute top-1 bottom-1 left-1 flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing shadow-sm ${
          isGreen ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}
        style={{
          width: `${HANDLE}px`,
          transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
        onMouseDown={(e) => { e.preventDefault(); onStart(e.clientX) }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
      >
        {loading || triggered ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Any approval notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <SwipeConfirm
              label="Slide to approve →"
              color="green"
              loading={loading === "approve"}
              onConfirm={handleApprove}
            />
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Reason for rejection</Label>
              <textarea
                className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Explain why this PO is being rejected..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <SwipeConfirm
              label="Slide to reject →"
              color="red"
              loading={loading === "reject"}
              onConfirm={handleReject}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

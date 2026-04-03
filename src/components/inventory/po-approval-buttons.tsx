"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react"
import { approvePurchaseOrder, rejectPurchaseOrder } from "@/actions/inventory"

interface POApprovalButtonsProps {
  poId: string
  approvalStatus: string
}

interface SwipeConfirmProps {
  label: string
  sublabel: string
  color: "green" | "red"
  direction: "right" | "left"
  loading: boolean
  onConfirm: () => void
}

function SwipeConfirm({ label, sublabel, color, direction, loading, onConfirm }: SwipeConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const startClientX = useRef(0)

  const HANDLE = 44
  const THRESHOLD = 0.72
  const isRight = direction === "right"
  const isGreen = color === "green"

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

  useEffect(() => {
    if (!loading) { setX(0); setTriggered(false) }
  }, [loading])

  const pct = trackWidth() > 0 ? x / trackWidth() : 0

  // For left-swipe (reject): handle starts at right, moves left
  // We mirror the visual by using CSS transform scaleX(-1) on the track
  // but keep the logic the same (drag right to trigger)
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground text-center">{sublabel}</p>
      <div
        ref={trackRef}
        className={`relative h-12 rounded-full overflow-hidden select-none ${
          isGreen ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-red-100 dark:bg-red-950/40"
        } ${!isRight ? "[transform:scaleX(-1)]" : ""}`}
      >
        {/* Fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${isGreen ? "bg-emerald-200 dark:bg-emerald-800/50" : "bg-red-200 dark:bg-red-800/50"}`}
          style={{ width: `${HANDLE + 8 + x}px`, transition: dragging ? "none" : "width 0.25s ease" }}
        />
        {/* Label — mirror back so text reads correctly */}
        <span
          className={`absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none ${
            isGreen ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
          } ${!isRight ? "[transform:scaleX(-1)]" : ""}`}
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
          ) : isRight ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4 [transform:scaleX(-1)]" />
          )}
        </div>
      </div>
    </div>
  )
}

export function POApprovalButtons({ poId, approvalStatus }: POApprovalButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)

  if (approvalStatus !== "pending_approval") return null

  async function handleApprove() {
    setLoading("approve")
    const result = await approvePurchaseOrder(poId, "")
    setLoading(null)
    if (result && "error" in result) { toast.error(result.error); return }
    toast.success("Purchase order approved")
    router.refresh()
  }

  async function handleReject() {
    setLoading("reject")
    const result = await rejectPurchaseOrder(poId, "")
    setLoading(null)
    if (result && "error" in result) { toast.error(result.error); return }
    toast.success("Purchase order rejected")
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <SwipeConfirm
        label="Swipe to approve →"
        sublabel="Swipe right to approve"
        color="green"
        direction="right"
        loading={loading === "approve"}
        onConfirm={handleApprove}
      />
      <SwipeConfirm
        label="← Swipe to reject"
        sublabel="Swipe left to reject"
        color="red"
        direction="left"
        loading={loading === "reject"}
        onConfirm={handleReject}
      />
    </div>
  )
}

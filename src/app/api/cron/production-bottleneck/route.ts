import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const THRESHOLDS = [
  { pct: 100, type: "bottleneck_overdue", label: "Blocked — exceeded expected duration" },
  { pct: 90, type: "bottleneck_90", label: "Critical — 90% of expected duration" },
  { pct: 75, type: "bottleneck_75", label: "Warning — 75% of expected duration" },
  { pct: 50, type: "bottleneck_50", label: "Info — halfway through expected duration" },
] as const

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Get in-production orders with their tracking rows that are in_progress
  const { data: orders, error: ordErr } = await admin
    .from("orders")
    .select("id, order_number, product_variant, created_at, deadline")
    .eq("status", "in_production")
    .not("deadline", "is", null)

  if (ordErr) {
    return NextResponse.json({ error: ordErr.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "No in-production orders" })
  }

  // Get all in-progress tracking rows for these orders
  const orderIds = orders.map((o) => o.id)
  const { data: tracking, error: trkErr } = await admin
    .from("production_tracking")
    .select("id, order_id, stage_id, started_at")
    .in("order_id", orderIds)
    .eq("status", "in_progress")
    .not("started_at", "is", null)

  if (trkErr) {
    return NextResponse.json({ error: trkErr.message }, { status: 500 })
  }

  if (!tracking || tracking.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "No in-progress stages" })
  }

  // Get stage names
  const stageIds = [...new Set(tracking.map((t) => t.stage_id))]
  const { data: stages } = await admin
    .from("production_stages")
    .select("id, name")
    .in("id", stageIds)

  const stageMap = new Map((stages ?? []).map((s) => [s.id, s.name]))
  const orderMap = new Map(orders.map((o) => [o.id, o]))

  // Fetch existing bottleneck notifications
  const trackingIds = tracking.map((t) => t.id)
  const { data: existing } = await admin
    .from("notifications")
    .select("type, reference_id")
    .in("type", THRESHOLDS.map((t) => t.type))
    .in("reference_id", trackingIds)

  const notifiedSet = new Set(
    (existing ?? []).map((n) => `${n.type}:${n.reference_id}`)
  )

  const notifications: {
    type: string
    title: string
    message: string
    reference_type: string
    reference_id: string
    is_read: boolean
  }[] = []

  for (const trk of tracking) {
    const order = orderMap.get(trk.order_id)
    if (!order) continue

    const orderCreated = new Date(order.created_at)
    const orderDeadline = new Date(order.deadline!)
    const totalOrderMs = orderDeadline.getTime() - orderCreated.getTime()
    if (totalOrderMs <= 0) continue

    // Each stage gets 1/7 of the total order duration
    const stageDurationMs = totalOrderMs / 7
    const stageStarted = new Date(trk.started_at!)
    const stageElapsedMs = now.getTime() - stageStarted.getTime()
    const pct = (stageElapsedMs / stageDurationMs) * 100

    const stageName = stageMap.get(trk.stage_id) ?? "Unknown stage"

    for (const threshold of THRESHOLDS) {
      if (pct >= threshold.pct) {
        const key = `${threshold.type}:${trk.id}`
        if (!notifiedSet.has(key)) {
          notifications.push({
            type: threshold.type,
            title: `${stageName} — ${threshold.label}`,
            message: `${stageName} for order ${order.order_number} at ${Math.round(pct)}% of expected duration`,
            reference_type: "production_tracking",
            reference_id: trk.id,
            is_read: false,
          })
          notifiedSet.add(key)
        }
        break
      }
    }
  }

  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications)
  }

  return NextResponse.json({ ok: true, count: notifications.length })
}

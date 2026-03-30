import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const THRESHOLDS = [
  { pct: 100, type: "order_deadline_overdue", label: "Overdue" },
  { pct: 90, type: "order_deadline_90", label: "Critical deadline alert" },
  { pct: 75, type: "order_deadline_75", label: "Approaching deadline" },
  { pct: 50, type: "order_deadline_50", label: "Halfway to deadline" },
] as const

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()

  // Active orders with deadlines
  const { data: orders, error } = await admin
    .from("orders")
    .select("id, order_number, product_variant, created_at, deadline")
    .in("status", ["confirmed", "in_production"])
    .not("deadline", "is", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "No active orders with deadlines" })
  }

  // Fetch all existing deadline notifications in one query
  const orderIds = orders.map((o) => o.id)
  const { data: existing } = await admin
    .from("notifications")
    .select("type, reference_id")
    .in("type", THRESHOLDS.map((t) => t.type))
    .in("reference_id", orderIds)

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

  for (const order of orders) {
    const created = new Date(order.created_at)
    const deadline = new Date(order.deadline!)
    const totalMs = deadline.getTime() - created.getTime()
    if (totalMs <= 0) continue

    const elapsedMs = now.getTime() - created.getTime()
    const pct = (elapsedMs / totalMs) * 100

    // Find highest threshold crossed
    for (const threshold of THRESHOLDS) {
      if (pct >= threshold.pct) {
        const key = `${threshold.type}:${order.id}`
        if (!notifiedSet.has(key)) {
          notifications.push({
            type: threshold.type,
            title: `Order ${order.order_number} — ${threshold.label}`,
            message: `${order.product_variant ?? order.order_number} is at ${Math.round(pct)}% of its timeline (deadline: ${order.deadline})`,
            reference_type: "order",
            reference_id: order.id,
            is_read: false,
          })
          notifiedSet.add(key) // prevent duplicate thresholds for same order
        }
        break // only insert highest un-notified threshold
      }
    }
  }

  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications)
  }

  return NextResponse.json({ ok: true, count: notifications.length })
}

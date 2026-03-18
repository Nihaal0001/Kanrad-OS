export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOwnerDailyDigest } from "@/lib/whatsapp"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { count: activeOrders },
    { count: pendingLeaves },
    { data: overdueInvoices },
    { data: lowStockRaw },
    { count: todayAttendance },
    { count: totalWorkers },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }).in("status", ["confirmed", "in_production"]),
    supabase.from("leaves").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("invoices").select("total_amount, amount_paid").in("status", ["sent", "partially_paid"]).lt("due_date", today),
    supabase.from("materials").select("current_stock, min_stock_level").eq("is_active", true),
    supabase.from("attendance").select("*", { count: "exact", head: true }).eq("date", today),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
  ])

  const overdueCount = (overdueInvoices ?? []).length
  const overdueAmount = (overdueInvoices ?? []).reduce(
    (s, i) => s + Math.max(0, (i.total_amount ?? 0) - (i.amount_paid ?? 0)),
    0
  )
  const lowStockCount = (lowStockRaw ?? []).filter(
    (m) => m.current_stock < m.min_stock_level
  ).length

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const result = await sendOwnerDailyDigest({
    date: dateLabel,
    activeOrders: activeOrders ?? 0,
    pendingLeaves: pendingLeaves ?? 0,
    overdueInvoices: overdueCount,
    overdueAmount,
    lowStockItems: lowStockCount,
    todayAttendance: todayAttendance ?? 0,
    totalWorkers: totalWorkers ?? 0,
  })

  return Response.json({ sent: result.success, error: result.error })
}

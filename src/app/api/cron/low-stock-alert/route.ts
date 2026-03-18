export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendLowStockAlert } from "@/lib/email"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("materials")
    .select("name, sku, current_stock, min_stock_level, unit")
    .eq("is_active", true)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const lowStock = (data ?? []).filter(
    (m) => m.current_stock < m.min_stock_level
  )

  if (lowStock.length === 0) {
    return Response.json({ sent: false, reason: "No low stock items" })
  }

  const result = await sendLowStockAlert(lowStock)
  return Response.json({ sent: result.success, count: lowStock.length, error: result.error })
}

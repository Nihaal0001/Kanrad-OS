export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOverdueInvoiceAlert } from "@/lib/email"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("invoices")
    .select("invoice_number, buyer_name, total_amount, amount_paid, due_date, status")
    .in("status", ["sent", "partially_paid"])
    .lt("due_date", today)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const overdue = (data ?? []).map((inv) => ({
    invoice_number: inv.invoice_number ?? "—",
    buyer_name: inv.buyer_name ?? "—",
    total_amount: inv.total_amount ?? 0,
    due_date: inv.due_date ?? "",
    outstanding: Math.max(0, (inv.total_amount ?? 0) - (inv.amount_paid ?? 0)),
  }))

  if (overdue.length === 0) {
    return Response.json({ sent: false, reason: "No overdue invoices" })
  }

  const result = await sendOverdueInvoiceAlert(overdue)
  return Response.json({ sent: result.success, count: overdue.length, error: result.error })
}

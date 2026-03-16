import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  // Find purchase invoices that are past due and still draft/received
  const { data: overdue, error } = await admin
    .from("purchase_invoices")
    .select("id, invoice_number, supplier_name, due_date")
    .lt("due_date", today)
    .in("status", ["draft", "received"])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "No overdue purchase invoices" })
  }

  // Dedup: check which already have an overdue notification
  const invoiceIds = overdue.map((inv) => inv.id)
  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id")
    .eq("type", "purchase_invoice_overdue")
    .in("reference_id", invoiceIds)

  const alreadyNotified = new Set((existing ?? []).map((n) => n.reference_id))
  const newOverdue = overdue.filter((inv) => !alreadyNotified.has(inv.id))

  if (newOverdue.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "All already notified" })
  }

  const notifications = newOverdue.map((inv) => ({
    type: "purchase_invoice_overdue",
    title: "Purchase Invoice Overdue",
    message: `${inv.invoice_number || "Purchase invoice"} from ${inv.supplier_name} is past due (${inv.due_date})`,
    reference_type: "purchase_invoice",
    reference_id: inv.id,
    is_read: false,
  }))

  await admin.from("notifications").insert(notifications)

  await admin
    .from("purchase_invoices")
    .update({ status: "overdue" })
    .in("id", newOverdue.map((inv) => inv.id))

  return NextResponse.json({ ok: true, count: newOverdue.length })
}

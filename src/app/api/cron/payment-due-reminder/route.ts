export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPaymentDueReminder } from "@/lib/email"
import { todayIST } from "@/lib/payment-terms"

// Runs every morning: reminds the owner of supplier bills whose payment falls due today.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 })
  }

  const admin = createAdminClient()
  const today = todayIST()

  const { data, error } = await admin
    .from("purchase_invoices")
    .select("id, invoice_number, supplier_name, due_date, total_amount, amount_paid")
    .eq("due_date", today)
    .in("status", ["received", "partially_paid", "overdue"])

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const due = (data ?? []).filter((b) => (b.total_amount ?? 0) - (b.amount_paid ?? 0) > 0.01)
  if (due.length === 0) return Response.json({ ok: true, count: 0, message: "No payments due today" })

  // Dedup so a cron retry doesn't notify twice
  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id")
    .eq("type", "payment_due_today")
    .in("reference_id", due.map((b) => b.id))
    .gte("created_at", `${today}T00:00:00+05:30`)
  const already = new Set((existing ?? []).map((n) => n.reference_id))
  const fresh = due.filter((b) => !already.has(b.id))
  if (fresh.length === 0) return Response.json({ ok: true, count: 0, message: "Already reminded" })

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
  const outstanding = (b: (typeof fresh)[number]) => (b.total_amount ?? 0) - (b.amount_paid ?? 0)

  const { error: notifError } = await admin.from("notifications").insert(
    fresh.map((b) => ({
      type: "payment_due_today",
      title: "Payment due today",
      message: `Pay ${fmt(outstanding(b))} to ${b.supplier_name} today (${b.invoice_number || "bill"}, due ${b.due_date})`,
      reference_type: "purchase_invoice",
      reference_id: b.id,
      is_read: false,
    }))
  )
  if (notifError) return Response.json({ error: notifError.message }, { status: 500 })

  const email = await sendPaymentDueReminder(
    fresh.map((b) => ({
      invoice_number: b.invoice_number ?? "—",
      supplier_name: b.supplier_name,
      due_date: b.due_date,
      outstanding: outstanding(b),
    }))
  )

  return Response.json({ ok: true, count: fresh.length, emailed: email.success, emailError: email.error })
}

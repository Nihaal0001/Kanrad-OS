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

  // Tasks past due that aren't done/cancelled
  const { data: overdue, error } = await admin
    .from("tasks")
    .select("id, title, due_date")
    .lt("due_date", today)
    .not("status", "in", '("done","cancelled")')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!overdue || overdue.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "No overdue tasks" })
  }

  // Dedup
  const taskIds = overdue.map((t) => t.id)
  const { data: existing } = await admin
    .from("notifications")
    .select("reference_id")
    .eq("type", "task_overdue")
    .in("reference_id", taskIds)

  const alreadyNotified = new Set((existing ?? []).map((n) => n.reference_id))
  const newOverdue = overdue.filter((t) => !alreadyNotified.has(t.id))

  if (newOverdue.length === 0) {
    return NextResponse.json({ ok: true, count: 0, message: "All overdue tasks already notified" })
  }

  const notifications = newOverdue.map((t) => ({
    type: "task_overdue",
    title: "Task Overdue",
    message: `Task "${t.title}" is past due (${t.due_date})`,
    reference_type: "task",
    reference_id: t.id,
    is_read: false,
  }))

  await admin.from("notifications").insert(notifications)

  return NextResponse.json({ ok: true, count: newOverdue.length })
}

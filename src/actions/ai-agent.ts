"use server"

import { runAgentTurn, type AgentResult, type AgentMessage } from "@/lib/ai/agent"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { revalidatePath } from "next/cache"

type AgentResponse = AgentResult | { error: string }

export async function askAgent(
  message: string,
  history: AgentMessage[] = []
): Promise<AgentResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    if (!rateLimit(`ai_agent:${user.id}`, 20, 60_000)) {
      return { error: "Too many requests — please wait a minute." }
    }
    return await runAgentTurn(message, history)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Agent unavailable" }
  }
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, message: "Not authenticated" }

    const admin = createAdminClient()
    const today = new Date().toISOString().split("T")[0]

    async function resolveWorker(name: string) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${name}%`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      return data
    }

    switch (name) {
      case "get_attendance_today":
      case "get_order_status":
      case "get_production_status":
      case "get_pending_leaves":
      case "get_low_stock":
      case "get_workers":
        return { success: true, message: "Query completed." }

      case "mark_attendance": {
        const workerName = String(args.worker_name ?? "")
        const type = String(args.type ?? "IN").toUpperCase() as "IN" | "OUT"
        const worker = await resolveWorker(workerName)
        if (!worker) return { success: false, message: `Worker "${workerName}" not found.` }

        const { data: existing } = await admin
          .from("attendance")
          .select("check_in")
          .eq("worker_id", worker.id)
          .eq("date", today)
          .maybeSingle()

        const now = new Date().toISOString()
        await admin.from("attendance").upsert({
          worker_id: worker.id,
          date: today,
          status: "present",
          check_in: type === "IN" ? now : (existing?.check_in ?? null),
          check_out: type === "OUT" ? now : null,
        }, { onConflict: "worker_id,date" })

        revalidatePath("/hr/attendance")
        return { success: true, message: `${worker.full_name} marked ${type} at ${new Date().toLocaleTimeString("en-IN")}.` }
      }

      case "approve_leave": {
        const workerName = String(args.worker_name ?? "")
        const worker = await resolveWorker(workerName)
        if (!worker) return { success: false, message: `Worker "${workerName}" not found.` }

        const { data: leave } = await admin
          .from("leaves")
          .select("id")
          .eq("worker_id", worker.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!leave) return { success: false, message: `No pending leave found for ${worker.full_name}.` }

        await admin.from("leaves").update({ status: "approved" }).eq("id", leave.id)
        revalidatePath("/hr/leaves")
        return { success: true, message: `Leave approved for ${worker.full_name}.` }
      }

      case "reject_leave": {
        const workerName = String(args.worker_name ?? "")
        const reason = args.reason ? String(args.reason) : null
        const worker = await resolveWorker(workerName)
        if (!worker) return { success: false, message: `Worker "${workerName}" not found.` }

        const { data: leave } = await admin
          .from("leaves")
          .select("id")
          .eq("worker_id", worker.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!leave) return { success: false, message: `No pending leave found for ${worker.full_name}.` }

        await admin.from("leaves").update({ status: "rejected", rejection_reason: reason }).eq("id", leave.id)
        revalidatePath("/hr/leaves")
        return { success: true, message: `Leave rejected for ${worker.full_name}.` }
      }

      case "create_task": {
        const title = String(args.title ?? "").trim()
        if (!title) return { success: false, message: "Task title is required." }

        let assignedId: string | null = null
        if (args.assigned_to) {
          const w = await resolveWorker(String(args.assigned_to))
          assignedId = w?.id ?? null
        }

        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle()

        const priority = ["low", "normal", "high", "urgent"].includes(String(args.priority ?? ""))
          ? String(args.priority)
          : "normal"

        await admin.from("tasks").insert({
          title,
          assigned_to: assignedId,
          due_date: args.due_date ? String(args.due_date) : null,
          priority,
          status: "todo",
          created_by: profile?.id ?? null,
        })

        revalidatePath("/tasks")
        return { success: true, message: `Task "${title}" created successfully.` }
      }

      case "update_task_status": {
        const taskTitle = String(args.task_title ?? "")
        const status = String(args.status ?? "")

        const { data: task } = await admin
          .from("tasks")
          .select("id, title")
          .ilike("title", `%${taskTitle}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (!task) return { success: false, message: `Task "${taskTitle}" not found.` }

        await admin.from("tasks").update({ status }).eq("id", task.id)
        revalidatePath("/tasks")
        return { success: true, message: `Task "${task.title}" updated to ${status}.` }
      }

      case "update_production_stage": {
        const orderNumber = String(args.order_number ?? "")
        const stageName = String(args.stage_name ?? "")
        const status = String(args.status ?? "")

        const { data: order } = await admin
          .from("orders")
          .select("id")
          .ilike("order_number", `%${orderNumber}%`)
          .limit(1)
          .maybeSingle()

        if (!order) return { success: false, message: `Order "${orderNumber}" not found.` }

        const { data: stage } = await admin
          .from("production_stages")
          .select("id")
          .ilike("name", `%${stageName}%`)
          .limit(1)
          .maybeSingle()

        if (!stage) return { success: false, message: `Stage "${stageName}" not found.` }

        const { error } = await admin
          .from("production_tracking")
          .update({ status })
          .eq("order_id", order.id)
          .eq("stage_id", stage.id)

        if (error) return { success: false, message: `Could not update: ${error.message}` }

        revalidatePath("/production")
        return { success: true, message: `${stageName} stage for ${orderNumber} updated to ${status}.` }
      }

      default:
        return { success: false, message: `Unknown action: ${name}` }
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Execution failed" }
  }
}

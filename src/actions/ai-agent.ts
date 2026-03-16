"use server"

import { runAgentTurn, TOOL_PERMISSIONS, type AgentResult, type AgentMessage } from "@/lib/ai/agent"
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

    // Fetch user's role permissions for tool filtering
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_id", user.id)
      .maybeSingle()

    let permissions: string[] = []
    if (profile?.role && profile.role !== "admin") {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", profile.role)
      permissions = (perms ?? []).map((p) => p.permission)
      // If no DB permissions found, use basic defaults
      if (permissions.length === 0) {
        const { DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions")
        permissions = [...(DEFAULT_ROLE_PERMISSIONS[profile.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [])]
      }
    }
    // admin or unknown role → empty array → all tools allowed

    return await runAgentTurn(message, history, permissions)
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

    // Permission check: verify user has module access for this tool
    const requiredPerm = TOOL_PERMISSIONS[name]
    if (requiredPerm) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_id", user.id)
        .maybeSingle()

      if (profile?.role && profile.role !== "admin") {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("permission")
          .eq("role", profile.role)
        let permissions = (perms ?? []).map((p) => p.permission)
        if (permissions.length === 0) {
          const { DEFAULT_ROLE_PERMISSIONS } = await import("@/lib/permissions")
          permissions = [...(DEFAULT_ROLE_PERMISSIONS[profile.role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [])]
        }
        if (!permissions.includes(requiredPerm)) {
          return { success: false, message: `You don't have permission for this action (requires ${requiredPerm}).` }
        }
      }
    }

    const admin = createAdminClient()
    const today = new Date().toISOString().split("T")[0]

    async function resolveWorker(workerName: string) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name")
        .ilike("full_name", `%${workerName}%`)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
      return data
    }

    switch (name) {
      // Read tools — these are executed in the Gemini loop, not here
      case "get_attendance_today":
      case "get_order_status":
      case "get_orders":
      case "get_buyers":
      case "get_production_status":
      case "get_pending_leaves":
      case "get_low_stock":
      case "get_materials":
      case "get_purchase_orders":
      case "get_workers":
      case "get_tasks":
      case "get_quality_checks":
      case "get_notifications":
      case "get_invoices":
      case "get_receivables_summary":
      case "get_expenses_summary":
      case "get_gst_summary":
      case "get_profit_loss":
        return { success: true, message: "Query completed." }

      // ── HR write tools ──
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

      // ── Task write tools ──
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

      // ── Production write tools ──
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

      // ── Order write tools ──
      case "create_order": {
        const styleName = String(args.style_name ?? "").trim()
        if (!styleName) return { success: false, message: "Style name is required." }

        const totalQuantity = Number(args.total_quantity ?? 0)
        if (totalQuantity <= 0) return { success: false, message: "Total quantity must be greater than 0." }

        const deadline = String(args.deadline ?? "")
        if (!deadline) return { success: false, message: "Deadline is required." }

        let buyerId: string | null = null
        if (args.buyer_name) {
          const { data: buyer } = await admin
            .from("buyers")
            .select("id, name")
            .ilike("name", `%${String(args.buyer_name)}%`)
            .limit(1)
            .maybeSingle()
          if (!buyer) return { success: false, message: `Buyer "${args.buyer_name}" not found. Create the buyer first.` }
          buyerId = buyer.id
        }

        const priority = ["low", "normal", "high", "urgent"].includes(String(args.priority ?? ""))
          ? String(args.priority)
          : "normal"

        const { data: order, error } = await admin
          .from("orders")
          .insert({
            style_name: styleName,
            buyer_id: buyerId,
            total_quantity: totalQuantity,
            deadline,
            priority,
            description: args.description ? String(args.description) : null,
            status: "draft",
          })
          .select("order_number")
          .single()

        if (error) return { success: false, message: `Failed to create order: ${error.message}` }

        revalidatePath("/orders")
        return { success: true, message: `Order ${order.order_number} created: ${styleName}, ${totalQuantity} pcs, deadline ${deadline}.` }
      }

      case "update_order_status": {
        const orderNumber = String(args.order_number ?? "")
        const status = String(args.status ?? "")
        const validStatuses = ["draft", "confirmed", "in_production", "completed", "dispatched", "cancelled"]
        if (!validStatuses.includes(status)) {
          return { success: false, message: `Invalid status. Use: ${validStatuses.join(", ")}` }
        }

        const { data: order } = await admin
          .from("orders")
          .select("id, order_number")
          .ilike("order_number", `%${orderNumber}%`)
          .limit(1)
          .maybeSingle()

        if (!order) return { success: false, message: `Order "${orderNumber}" not found.` }

        const { error } = await admin
          .from("orders")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", order.id)

        if (error) return { success: false, message: `Failed to update: ${error.message}` }

        revalidatePath("/orders")
        revalidatePath(`/orders/${order.id}`)
        return { success: true, message: `Order ${order.order_number} updated to ${status}.` }
      }

      // ── Buyer write tools ──
      case "create_buyer": {
        const buyerName = String(args.name ?? "").trim()
        if (!buyerName) return { success: false, message: "Buyer name is required." }

        const { data: buyer, error } = await admin
          .from("buyers")
          .insert({
            name: buyerName,
            company: args.company ? String(args.company) : null,
            phone: args.phone ? String(args.phone) : null,
            email: args.email ? String(args.email) : null,
            address: args.address ? String(args.address) : null,
          })
          .select("id, name")
          .single()

        if (error) return { success: false, message: `Failed to create buyer: ${error.message}` }

        revalidatePath("/orders/buyers")
        return { success: true, message: `Buyer "${buyer.name}" added successfully.` }
      }

      // ── Inventory write tools ──
      case "adjust_stock": {
        const materialName = String(args.material_name ?? "")
        const quantity = Number(args.quantity ?? 0)
        const txnType = String(args.type ?? "adjustment")
        const notes = args.notes ? String(args.notes) : null

        if (quantity === 0) return { success: false, message: "Quantity cannot be zero." }

        const { data: material } = await admin
          .from("materials")
          .select("id, name, current_stock, unit")
          .ilike("name", `%${materialName}%`)
          .limit(1)
          .maybeSingle()

        if (!material) return { success: false, message: `Material "${materialName}" not found.` }

        const newStock = material.current_stock + quantity
        if (newStock < 0) return { success: false, message: `Cannot reduce below zero. Current stock: ${material.current_stock} ${material.unit}.` }

        // Insert stock transaction (append-only ledger)
        await admin.from("stock_transactions").insert({
          material_id: material.id,
          type: txnType,
          quantity: Math.abs(quantity),
          direction: quantity > 0 ? "in" : "out",
          notes,
        })

        // Update current stock
        await admin
          .from("materials")
          .update({ current_stock: newStock })
          .eq("id", material.id)

        revalidatePath("/inventory")
        revalidatePath(`/inventory/${material.id}`)
        const direction = quantity > 0 ? "added" : "removed"
        return { success: true, message: `${Math.abs(quantity)} ${material.unit} ${direction} for ${material.name}. New stock: ${newStock} ${material.unit}.` }
      }

      // ── Quality write tools ──
      case "create_quality_check": {
        const orderNumber = String(args.order_number ?? "")
        const stageName = String(args.stage_name ?? "")

        const { data: order } = await admin
          .from("orders")
          .select("id, order_number")
          .ilike("order_number", `%${orderNumber}%`)
          .limit(1)
          .maybeSingle()

        if (!order) return { success: false, message: `Order "${orderNumber}" not found.` }

        const { data: stage } = await admin
          .from("production_stages")
          .select("id, name")
          .ilike("name", `%${stageName}%`)
          .limit(1)
          .maybeSingle()

        if (!stage) return { success: false, message: `Stage "${stageName}" not found.` }

        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle()

        const { error } = await admin.from("quality_checks").insert({
          order_id: order.id,
          stage_id: stage.id,
          inspector_id: profile?.id ?? null,
          quantity_checked: Number(args.quantity_checked ?? 0),
          quantity_passed: Number(args.quantity_passed ?? 0),
          quantity_failed: Number(args.quantity_failed ?? 0),
          defect_type: args.defect_type ? String(args.defect_type) : null,
          notes: args.notes ? String(args.notes) : null,
        })

        if (error) return { success: false, message: `Failed to log QC: ${error.message}` }

        revalidatePath("/quality")
        revalidatePath(`/production/${order.id}`)
        return {
          success: true,
          message: `QC logged for ${order.order_number} at ${stage.name}: ${args.quantity_passed} passed, ${args.quantity_failed} failed.`,
        }
      }

      // ── Notification write tools ──
      case "mark_notifications_read": {
        const { data: profile } = await admin
          .from("profiles")
          .select("id")
          .eq("auth_id", user.id)
          .maybeSingle()

        if (!profile) return { success: false, message: "Profile not found." }

        const { error } = await admin
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", profile.id)
          .eq("is_read", false)

        if (error) return { success: false, message: `Failed: ${error.message}` }

        revalidatePath("/notifications")
        return { success: true, message: "All notifications marked as read." }
      }

      default:
        return { success: false, message: `Unknown action: ${name}` }
    }
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Execution failed" }
  }
}

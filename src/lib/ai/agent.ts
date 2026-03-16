import { FunctionCallingMode, SchemaType, type FunctionDeclaration } from "@google/generative-ai"
import { getGeminiClient } from "@/lib/ai/gemini"
import { buildERPContext } from "@/lib/ai/context"
import { createAdminClient } from "@/lib/supabase/admin"

export type AgentResult =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; displayText: string }

// ── Tool → module permission mapping ──────────────────────────────────────
export const TOOL_PERMISSIONS: Record<string, string> = {
  // Orders & Buyers
  get_orders: "orders",
  get_order_status: "orders",
  create_order: "orders",
  update_order_status: "orders",
  get_buyers: "orders",
  create_buyer: "orders",
  // Inventory
  get_materials: "inventory",
  get_low_stock: "inventory",
  get_purchase_orders: "inventory",
  adjust_stock: "inventory",
  // Production
  get_production_status: "production",
  update_production_stage: "production",
  // Quality
  get_quality_checks: "quality",
  create_quality_check: "quality",
  // Tasks
  get_tasks: "tasks",
  create_task: "tasks",
  update_task_status: "tasks",
  // HR
  get_attendance_today: "hr",
  mark_attendance: "hr",
  get_pending_leaves: "hr",
  approve_leave: "hr",
  reject_leave: "hr",
  // General
  get_workers: "dashboard",
  // Notifications
  get_notifications: "notifications",
  mark_notifications_read: "notifications",
}

export const WRITE_TOOL_NAMES = [
  "mark_attendance",
  "approve_leave",
  "reject_leave",
  "create_task",
  "update_task_status",
  "update_production_stage",
  "create_order",
  "update_order_status",
  "create_buyer",
  "adjust_stock",
  "create_quality_check",
  "mark_notifications_read",
] as const

// ── All tool declarations ─────────────────────────────────────────────────
const toolDeclarations: FunctionDeclaration[] = [
  // ── Read tools ──
  {
    name: "get_attendance_today",
    description: "Get today's attendance summary — how many workers are present, absent, etc.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_order_status",
    description: "Get details and status of a specific order by order number.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "The order number, e.g. JC-ORD-250101-001" },
      },
      required: ["order_number"],
    },
  },
  {
    name: "get_orders",
    description: "List orders. Optionally filter by status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Filter by status: draft, confirmed, in_production, completed, dispatched, cancelled (optional)" },
      },
    },
  },
  {
    name: "get_buyers",
    description: "List all buyers/clients.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_production_status",
    description: "Get current production pipeline status. Optionally filter by order number.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "Optional order number to filter" },
      },
    },
  },
  {
    name: "get_pending_leaves",
    description: "Get all pending leave requests awaiting approval.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_low_stock",
    description: "Get materials that are below their minimum stock level.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_materials",
    description: "List all materials with their stock levels.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_purchase_orders",
    description: "List purchase orders. Optionally filter by status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Filter: draft, sent, ordered, partial, received, cancelled (optional)" },
      },
    },
  },
  {
    name: "get_workers",
    description: "Get the list of active workers in the factory.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "get_tasks",
    description: "List tasks. Optionally filter by status.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Filter: todo, in_progress, done, cancelled (optional)" },
      },
    },
  },
  {
    name: "get_quality_checks",
    description: "Get recent quality check inspections.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "Optional order number to filter" },
      },
    },
  },
  {
    name: "get_notifications",
    description: "Get recent unread notifications.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },

  // ── Write tools ──
  {
    name: "mark_attendance",
    description: "Mark a worker's attendance as IN (check-in) or OUT (check-out) for today.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        worker_name: { type: SchemaType.STRING, description: "Full or partial name of the worker" },
        type: { type: SchemaType.STRING, description: "IN for check-in, OUT for check-out" },
      },
      required: ["worker_name", "type"],
    },
  },
  {
    name: "approve_leave",
    description: "Approve the most recent pending leave request for a worker.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        worker_name: { type: SchemaType.STRING, description: "Full or partial name of the worker" },
      },
      required: ["worker_name"],
    },
  },
  {
    name: "reject_leave",
    description: "Reject the most recent pending leave request for a worker.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        worker_name: { type: SchemaType.STRING, description: "Full or partial name of the worker" },
        reason: { type: SchemaType.STRING, description: "Reason for rejection (optional)" },
      },
      required: ["worker_name"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Task title" },
        assigned_to: { type: SchemaType.STRING, description: "Worker name to assign to (optional)" },
        due_date: { type: SchemaType.STRING, description: "Due date YYYY-MM-DD (optional)" },
        priority: { type: SchemaType.STRING, description: "low, normal, high, or urgent (optional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of an existing task.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        task_title: { type: SchemaType.STRING, description: "Title or partial title of the task" },
        status: { type: SchemaType.STRING, description: "todo, in_progress, done, or cancelled" },
      },
      required: ["task_title", "status"],
    },
  },
  {
    name: "update_production_stage",
    description: "Update the status of a production stage for an order.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "The order number" },
        stage_name: { type: SchemaType.STRING, description: "Stage name, e.g. Cutting, Stitching" },
        status: { type: SchemaType.STRING, description: "pending, in_progress, completed, or blocked" },
      },
      required: ["order_number", "stage_name", "status"],
    },
  },
  {
    name: "create_order",
    description: "Create a new garment order.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        style_name: { type: SchemaType.STRING, description: "Style/garment name, e.g. 'Polo T-Shirt'" },
        buyer_name: { type: SchemaType.STRING, description: "Buyer name (must match an existing buyer)" },
        total_quantity: { type: SchemaType.NUMBER, description: "Total number of pieces to produce" },
        deadline: { type: SchemaType.STRING, description: "Deadline in YYYY-MM-DD format" },
        priority: { type: SchemaType.STRING, description: "low, normal, high, or urgent (optional, defaults to normal)" },
        description: { type: SchemaType.STRING, description: "Brief description or notes (optional)" },
      },
      required: ["style_name", "total_quantity", "deadline"],
    },
  },
  {
    name: "update_order_status",
    description: "Update the status of an existing order.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "The order number" },
        status: { type: SchemaType.STRING, description: "draft, confirmed, in_production, completed, dispatched, or cancelled" },
      },
      required: ["order_number", "status"],
    },
  },
  {
    name: "create_buyer",
    description: "Add a new buyer/client.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "Buyer name" },
        company: { type: SchemaType.STRING, description: "Company name (optional)" },
        phone: { type: SchemaType.STRING, description: "Phone number (optional)" },
        email: { type: SchemaType.STRING, description: "Email address (optional)" },
        address: { type: SchemaType.STRING, description: "Address (optional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "adjust_stock",
    description: "Adjust stock level for a material — add or remove stock.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        material_name: { type: SchemaType.STRING, description: "Material name (partial match)" },
        quantity: { type: SchemaType.NUMBER, description: "Quantity to add (positive) or remove (negative)" },
        type: { type: SchemaType.STRING, description: "Transaction type: purchase, adjustment, return, waste" },
        notes: { type: SchemaType.STRING, description: "Reason or notes (optional)" },
      },
      required: ["material_name", "quantity", "type"],
    },
  },
  {
    name: "create_quality_check",
    description: "Log a quality check inspection for an order at a specific production stage.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        order_number: { type: SchemaType.STRING, description: "The order number" },
        stage_name: { type: SchemaType.STRING, description: "Production stage, e.g. Cutting, Stitching" },
        quantity_checked: { type: SchemaType.NUMBER, description: "Number of pieces checked" },
        quantity_passed: { type: SchemaType.NUMBER, description: "Number that passed" },
        quantity_failed: { type: SchemaType.NUMBER, description: "Number that failed" },
        defect_type: { type: SchemaType.STRING, description: "Type of defect found (optional)" },
        notes: { type: SchemaType.STRING, description: "Inspector notes (optional)" },
      },
      required: ["order_number", "stage_name", "quantity_checked", "quantity_passed", "quantity_failed"],
    },
  },
  {
    name: "mark_notifications_read",
    description: "Mark all unread notifications as read.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
]

function buildDisplayText(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "mark_attendance":
      return `Mark **${args.worker_name}** as **${String(args.type).toUpperCase()}** today`
    case "approve_leave":
      return `Approve leave request for **${args.worker_name}**`
    case "reject_leave":
      return `Reject leave request for **${args.worker_name}**${args.reason ? ` — reason: ${args.reason}` : ""}`
    case "create_task":
      return `Create task: **${args.title}**${args.assigned_to ? `, assign to ${args.assigned_to}` : ""}${args.priority ? `, priority: ${args.priority}` : ""}`
    case "update_task_status":
      return `Update task **"${args.task_title}"** → **${args.status}**`
    case "update_production_stage":
      return `Update **${args.stage_name}** stage for order **${args.order_number}** → **${args.status}**`
    case "create_order":
      return `Create order: **${args.style_name}**, ${args.total_quantity} pcs, deadline ${args.deadline}${args.buyer_name ? `, buyer: ${args.buyer_name}` : ""}`
    case "update_order_status":
      return `Update order **${args.order_number}** → **${args.status}**`
    case "create_buyer":
      return `Add buyer: **${args.name}**${args.company ? ` (${args.company})` : ""}`
    case "adjust_stock":
      return `Adjust stock for **${args.material_name}**: ${Number(args.quantity) > 0 ? "+" : ""}${args.quantity} (${args.type})`
    case "create_quality_check":
      return `Log QC for order **${args.order_number}** at **${args.stage_name}**: ${args.quantity_passed} passed, ${args.quantity_failed} failed`
    case "mark_notifications_read":
      return `Mark all notifications as **read**`
    default:
      return name
  }
}

const WRITE_TOOLS: Set<string> = new Set(WRITE_TOOL_NAMES)

// Execute read-only tools and return formatted data for Gemini
async function executeReadTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const admin = createAdminClient()
  const today = new Date().toISOString().split("T")[0]

  switch (name) {
    case "get_attendance_today": {
      const { data } = await admin
        .from("attendance")
        .select("status, worker:profiles!worker_id(full_name)")
        .eq("date", today)
      const present = (data ?? []).filter((a) => a.status === "present").length
      const halfDay = (data ?? []).filter((a) => a.status === "half_day").length
      const leave = (data ?? []).filter((a) => a.status === "leave").length
      const total = (data ?? []).length
      return { total_records: total, present, half_day: halfDay, on_leave: leave, date: today }
    }

    case "get_order_status": {
      const orderNumber = String(args.order_number ?? "")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await admin
        .from("orders")
        .select("order_number, style_name, status, priority, deadline, total_quantity, buyer:buyers(name)")
        .ilike("order_number", `%${orderNumber}%`)
        .limit(1)
        .maybeSingle() as { data: any }
      if (!data) return { error: `Order "${orderNumber}" not found` }
      return {
        order_number: data.order_number,
        style: data.style_name,
        status: data.status,
        priority: data.priority,
        deadline: data.deadline,
        quantity: data.total_quantity,
        buyer: data.buyer?.name ?? "N/A",
      }
    }

    case "get_orders": {
      let query = admin
        .from("orders")
        .select("order_number, style_name, status, priority, deadline, total_quantity")
        .order("created_at", { ascending: false })
        .limit(20)
      if (args.status) query = query.eq("status", String(args.status))
      const { data } = await query
      return {
        count: (data ?? []).length,
        orders: (data ?? []).map((o) => ({
          order_number: o.order_number,
          style: o.style_name,
          status: o.status,
          priority: o.priority,
          deadline: o.deadline,
          quantity: o.total_quantity,
        })),
      }
    }

    case "get_buyers": {
      const { data } = await admin
        .from("buyers")
        .select("name, company, phone, email")
        .order("name")
        .limit(50)
      return { count: (data ?? []).length, buyers: data ?? [] }
    }

    case "get_production_status": {
      const orderNumber = args.order_number ? String(args.order_number) : null
      let query = admin
        .from("production_tracking")
        .select("status, quantity_completed, quantity_rejected, order:orders(order_number, style_name), stage:production_stages(name)")
        .in("status", ["in_progress", "blocked", "pending"])
        .limit(20)

      if (orderNumber) {
        const { data: order } = await admin.from("orders").select("id").ilike("order_number", `%${orderNumber}%`).limit(1).maybeSingle()
        if (order) query = query.eq("order_id", order.id)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await query as { data: any[] | null }
      return {
        stages: (data ?? []).map((p) => ({
          order: Array.isArray(p.order) ? p.order[0]?.order_number : p.order?.order_number,
          stage: Array.isArray(p.stage) ? p.stage[0]?.name : p.stage?.name,
          status: p.status,
          completed: p.quantity_completed ?? 0,
          rejected: p.quantity_rejected ?? 0,
        })),
      }
    }

    case "get_pending_leaves": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await admin
        .from("leaves")
        .select("leave_type, from_date, to_date, days, reason, worker:profiles!worker_id(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20) as { data: any[] | null }
      return {
        pending_count: (data ?? []).length,
        leaves: (data ?? []).map((l) => ({
          worker: Array.isArray(l.worker) ? l.worker[0]?.full_name : l.worker?.full_name,
          type: l.leave_type,
          from: l.from_date,
          to: l.to_date,
          days: l.days,
          reason: l.reason,
        })),
      }
    }

    case "get_low_stock": {
      const { data } = await admin
        .from("materials")
        .select("name, sku, current_stock, min_stock_level, unit")
        .order("name")
        .limit(100)
      const low = (data ?? []).filter((m) => m.current_stock < m.min_stock_level)
      return {
        count: low.length,
        items: low.map((m) => ({
          name: m.name,
          sku: m.sku,
          stock: m.current_stock,
          min: m.min_stock_level,
          unit: m.unit,
        })),
      }
    }

    case "get_materials": {
      const { data } = await admin
        .from("materials")
        .select("name, sku, current_stock, min_stock_level, unit, cost_per_unit")
        .order("name")
        .limit(50)
      return {
        count: (data ?? []).length,
        materials: (data ?? []).map((m) => ({
          name: m.name,
          sku: m.sku,
          stock: m.current_stock,
          min_level: m.min_stock_level,
          unit: m.unit,
          cost: m.cost_per_unit,
          low_stock: m.current_stock < m.min_stock_level,
        })),
      }
    }

    case "get_purchase_orders": {
      let query = admin
        .from("purchase_orders")
        .select("po_number, supplier_name, status, total_amount, created_at")
        .order("created_at", { ascending: false })
        .limit(20)
      if (args.status) query = query.eq("status", String(args.status))
      const { data } = await query
      return { count: (data ?? []).length, purchase_orders: data ?? [] }
    }

    case "get_workers": {
      const { data } = await admin
        .from("profiles")
        .select("full_name, role, department, is_active")
        .eq("is_active", true)
        .order("full_name")
        .limit(200)
      return {
        count: (data ?? []).length,
        workers: (data ?? []).map((w) => ({
          name: w.full_name,
          role: w.role,
          department: w.department,
        })),
      }
    }

    case "get_tasks": {
      let query = admin
        .from("tasks")
        .select("title, status, priority, due_date, assigned:profiles!assigned_to(full_name)")
        .order("created_at", { ascending: false })
        .limit(20)
      if (args.status) query = query.eq("status", String(args.status))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await query as { data: any[] | null }
      return {
        count: (data ?? []).length,
        tasks: (data ?? []).map((t) => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          assigned_to: Array.isArray(t.assigned) ? t.assigned[0]?.full_name : t.assigned?.full_name,
        })),
      }
    }

    case "get_quality_checks": {
      let query = admin
        .from("quality_checks")
        .select("quantity_checked, quantity_passed, quantity_failed, defect_type, notes, created_at, order:orders(order_number, style_name), stage:production_stages(name)")
        .order("created_at", { ascending: false })
        .limit(15)

      if (args.order_number) {
        const { data: order } = await admin.from("orders").select("id").ilike("order_number", `%${String(args.order_number)}%`).limit(1).maybeSingle()
        if (order) query = query.eq("order_id", order.id)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await query as { data: any[] | null }
      return {
        count: (data ?? []).length,
        checks: (data ?? []).map((q) => ({
          order: Array.isArray(q.order) ? q.order[0]?.order_number : q.order?.order_number,
          stage: Array.isArray(q.stage) ? q.stage[0]?.name : q.stage?.name,
          checked: q.quantity_checked,
          passed: q.quantity_passed,
          failed: q.quantity_failed,
          defect: q.defect_type,
          notes: q.notes,
          date: q.created_at,
        })),
      }
    }

    case "get_notifications": {
      const { data } = await admin
        .from("notifications")
        .select("title, message, type, is_read, created_at")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(15)
      return { count: (data ?? []).length, notifications: data ?? [] }
    }

    default:
      return { error: `Unknown read tool: ${name}` }
  }
}

export interface AgentMessage {
  role: "user" | "assistant"
  content: string
}

export async function runAgentTurn(
  transcript: string,
  history: AgentMessage[] = [],
  permissions: string[] = []
): Promise<AgentResult> {
  const ai = getGeminiClient()
  if (!ai) throw new Error("Gemini API key not configured")

  const admin = createAdminClient()
  const { data: workers } = await admin
    .from("profiles")
    .select("full_name")
    .eq("is_active", true)
    .order("full_name")
    .limit(200)

  const workerList = (workers ?? []).map((w) => w.full_name).join(", ")
  const context = await buildERPContext()
  const today = new Date().toISOString().split("T")[0]

  // Filter tools based on user permissions
  const allowedTools = permissions.length > 0
    ? toolDeclarations.filter((t) => {
        const requiredPerm = TOOL_PERMISSIONS[t.name]
        return !requiredPerm || permissions.includes(requiredPerm)
      })
    : toolDeclarations // admin or no permissions = all tools

  if (allowedTools.length === 0) {
    return { type: "text", content: "You don't have permission to use any agent tools." }
  }

  const permNote = permissions.length > 0
    ? `\nThe user has access to these modules only: ${permissions.join(", ")}. Do NOT attempt actions outside their permissions.`
    : ""

  const systemPrompt = `You are KYRE, an AI agent for JUST CLOTHING garment factory ERP. Today is ${today}.

You have tools to read data and perform actions. Always use a tool when the user asks you to do something or query data.

Active workers: ${workerList || "none listed"}

Current factory data:
${context}
${permNote}
Rules:
- Use a tool for every actionable or query request — do not just describe what you would do.
- For ambiguous worker names, pick the closest match from the workers list.
- Keep text responses to 1-2 sentences. Be direct and concise.
- For write actions, call the tool directly — do NOT call a read tool first unless you truly need data that is not in the context above.
- If the user asks you to do something you don't have tools for, explain politely that they need to use the app for that.`

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: allowedTools }],
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  })

  // Convert history to Gemini content format
  const geminiHistory = history.slice(-6).map((m) => ({
    role: m.role === "user" ? "user" as const : "model" as const,
    parts: [{ text: m.content }],
  }))

  // Use chat for multi-turn function calling loop
  const chat = model.startChat({ history: geminiHistory })
  let response = await chat.sendMessage(transcript)

  // Loop: execute read tools and feed results back to Gemini (max 5 iterations)
  for (let i = 0; i < 5; i++) {
    const calls = response.response.functionCalls()
    if (!calls || calls.length === 0) break

    const call = calls[0]
    const args = call.args as Record<string, unknown>

    // If it's a write tool, stop and return for user confirmation
    if (WRITE_TOOLS.has(call.name)) {
      return {
        type: "tool_call",
        name: call.name,
        args,
        displayText: buildDisplayText(call.name, args),
      }
    }

    // Read tool — execute and send result back to Gemini
    const toolResult = await executeReadTool(call.name, args)
    response = await chat.sendMessage([{
      functionResponse: {
        name: call.name,
        response: toolResult,
      },
    }])
  }

  return { type: "text", content: response.response.text() }
}

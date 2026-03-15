import { FunctionCallingMode, SchemaType, type FunctionDeclaration } from "@google/generative-ai"
import { getGeminiClient } from "@/lib/ai/gemini"
import { buildERPContext } from "@/lib/ai/context"
import { createAdminClient } from "@/lib/supabase/admin"

export type AgentResult =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; displayText: string }

export const WRITE_TOOL_NAMES = [
  "mark_attendance",
  "approve_leave",
  "reject_leave",
  "create_task",
  "update_task_status",
  "update_production_stage",
] as const

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
    name: "get_workers",
    description: "Get the list of active workers in the factory.",
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
  history: AgentMessage[] = []
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

  const systemPrompt = `You are KYRE, an AI agent for JUST CLOTHING garment factory ERP. Today is ${today}.

You have tools to read data and perform actions. Always use a tool when the user asks you to do something or query data.

Active workers: ${workerList || "none listed"}

Current factory data:
${context}

Rules:
- Use a tool for every actionable or query request — do not just describe what you would do.
- For ambiguous worker names, pick the closest match from the workers list.
- Keep text responses to 1-2 sentences. Be direct and concise.
- For write actions (mark_attendance, approve_leave, reject_leave, create_task, update_task_status, update_production_stage), call the tool directly — do NOT call a read tool first unless you truly need data that is not in the context above.`

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: toolDeclarations }],
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

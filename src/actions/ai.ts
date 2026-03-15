"use server"

import { askSarvam, speechToText, textToSpeech } from "@/lib/ai/sarvam"
import { askGemini } from "@/lib/ai/gemini"
import { buildERPContext } from "@/lib/ai/context"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

// ===== Types =====

export interface Insight {
  type: "warning" | "suggestion" | "alert"
  title: string
  description: string
  action?: { label: string; href: string }
}

export interface Suggestion {
  label: string
  description: string
  href: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// ===== Chat (Sarvam) =====

const CHAT_SYSTEM_PROMPT = `You are KYRE, a friendly, helpful AI assistant for JUST CLOTHING — a garment manufacturing factory. Think of yourself as a knowledgeable colleague who knows the factory inside-out.

Talk like a real person — warm, direct, no jargon unless the user uses it first. Keep answers short and natural. Use simple sentences, not walls of text.

IMPORTANT rules:
- Reply in the SAME LANGUAGE the user writes in. If they write in Hindi, reply in Hindi. If English, reply in English. If Tamil, reply in Tamil. Match their language exactly.
- Never output any XML tags, thinking tags, or reasoning markers. Just give the final answer directly.
- Keep it conversational — imagine you're chatting with a coworker, not writing a report.
- Use bullet points only when listing 3+ items. Otherwise just talk naturally.
- If you don't have the data to answer, say so honestly in one line.
- Currency is ₹ (Indian Rupees).
- Production stages: Fabric Sourcing → Cutting → Stitching → Quality Check → Finishing/Ironing → Packing → Dispatch.

Here is the current factory data to answer from:

`

export async function askAI(
  message: string,
  history: ChatMessage[] = []
): Promise<{ reply: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    if (!rateLimit(`ai_chat:${user.id}`, 20, 60_000)) {
      return { error: "Too many requests — please wait a minute and try again." }
    }

    const context = await buildERPContext()
    const systemPrompt = CHAT_SYSTEM_PROMPT + context

    // Keep only last 6 messages (3 exchanges) to limit token usage
    const recentHistory = history.slice(-6)

    const sarvamMessages = [
      ...recentHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ]

    const reply = await askSarvam(systemPrompt, sarvamMessages)
    return { reply }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI is unavailable"
    return { error: msg }
  }
}

// ===== Insights (Gemini) =====

const INSIGHTS_SYSTEM_PROMPT = `You are an operations analyst for JUST CLOTHING, a garment manufacturing factory ERP. Analyze the factory data and provide 3-5 actionable insights.

Return your response as a JSON array with this exact structure (no markdown, no code fences, just raw JSON):
[
  {
    "type": "warning" | "suggestion" | "alert",
    "title": "Short title",
    "description": "1-2 sentence explanation",
    "action": { "label": "Button text", "href": "/page-path" }
  }
]

Rules:
- "warning": deadline risks, quality issues, stock shortages
- "suggestion": optimization opportunities, cost savings
- "alert": urgent items needing immediate attention
- action.href must be a valid app route like /orders, /inventory, /production, /hr/attendance, /hr/payroll, /finance/invoices
- If there's nothing noteworthy, return a suggestion about maintaining current performance
- Keep titles under 60 chars, descriptions under 120 chars`

// Simple in-memory cache
let insightsCache: { data: Insight[]; timestamp: number } | null = null
const INSIGHTS_TTL = 60 * 60 * 1000 // 1 hour

export async function generateInsights(): Promise<
  { insights: Insight[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Return cached if fresh
  if (insightsCache && Date.now() - insightsCache.timestamp < INSIGHTS_TTL) {
    return { insights: insightsCache.data }
  }

  try {
    const context = await buildERPContext()
    const raw = await askGemini(
      INSIGHTS_SYSTEM_PROMPT,
      `Here is the current factory data:\n\n${context}\n\nProvide your insights as JSON.`
    )

    // Parse — strip any markdown fences if present
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned) as Insight[]

    insightsCache = { data: parsed, timestamp: Date.now() }
    return { insights: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI insights unavailable"
    return { error: msg }
  }
}

export async function refreshInsights(): Promise<
  { insights: Insight[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  insightsCache = null
  return generateInsights()
}

// ===== Smart Suggestions (Gemini) =====

const SUGGESTIONS_SYSTEM_PROMPT = `You are an operations assistant for JUST CLOTHING garment factory. Based on the factory data, suggest 3-5 actionable next steps.

Return your response as a JSON array (no markdown, no code fences, just raw JSON):
[
  {
    "label": "Short action label (5-8 words)",
    "description": "Why this action matters (1 sentence)",
    "href": "/valid-app-route"
  }
]

Valid routes:
- /orders/new, /orders, /inventory, /inventory/purchase-orders/new
- /production, /quality, /tasks, /hr/attendance, /hr/payroll, /hr/leaves
- /finance/invoices/new, /finance/invoices, /finance/costing

Prioritize urgent items: low stock → create PO, deadline risk → check production, pending leaves → review, etc.`

let suggestionsCache: { data: Suggestion[]; timestamp: number } | null = null
const SUGGESTIONS_TTL = 30 * 60 * 1000 // 30 minutes

export async function getSmartSuggestions(): Promise<
  { suggestions: Suggestion[] } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (
    suggestionsCache &&
    Date.now() - suggestionsCache.timestamp < SUGGESTIONS_TTL
  ) {
    return { suggestions: suggestionsCache.data }
  }

  try {
    const context = await buildERPContext()
    const raw = await askGemini(
      SUGGESTIONS_SYSTEM_PROMPT,
      `Current factory data:\n\n${context}\n\nProvide your suggestions as JSON.`
    )

    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned) as Suggestion[]

    suggestionsCache = { data: parsed, timestamp: Date.now() }
    return { suggestions: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI suggestions unavailable"
    return { error: msg }
  }
}

// ===== Order Summary (Gemini) =====

const ORDER_SUMMARY_PROMPT = `You are an operations analyst for JUST CLOTHING garment factory. Analyze the order data and provide a brief AI summary.

Return your response as a JSON object (no markdown, no code fences, just raw JSON):
{
  "risk_level": "low" | "medium" | "high",
  "summary": "2-3 sentence overview of the order status",
  "recommendations": ["actionable recommendation 1", "recommendation 2"]
}

Consider: deadline feasibility based on current production stage, material availability, quality issues, and workforce capacity.`

export async function generateOrderSummary(
  orderId: string
): Promise<{ summary: { risk_level: string; summary: string; recommendations: string[] } } | { error: string }> {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const [orderRes, trackingRes, qcRes, costingRes] = await Promise.all([
      supabase
        .from("orders")
        .select(`*, buyer:buyers(name), items:order_items(size, color, quantity, unit_price)`)
        .eq("id", orderId)
        .single(),
      supabase
        .from("production_tracking")
        .select(`*, stage:production_stages(name, sequence)`)
        .eq("order_id", orderId)
        .order("created_at"),
      supabase
        .from("quality_checks")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("order_costings")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle(),
    ])

    if (orderRes.error || !orderRes.data) {
      return { error: "Order not found" }
    }

    const order = orderRes.data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracking = (trackingRes.data ?? []) as any[]
    const qcChecks = qcRes.data ?? []
    const costing = costingRes.data

    const orderContext = [
      `Order: ${order.order_number} — ${order.style_name}`,
      `Buyer: ${Array.isArray(order.buyer) ? order.buyer[0]?.name : order.buyer?.name ?? "N/A"}`,
      `Quantity: ${order.total_quantity} pcs, Priority: ${order.priority}, Status: ${order.status}`,
      `Deadline: ${order.deadline}`,
      `Today: ${new Date().toISOString().split("T")[0]}`,
      "",
      "Production stages:",
      ...tracking.map((t) => {
        const stageName = Array.isArray(t.stage) ? t.stage[0]?.name : t.stage?.name
        return `  - ${stageName}: ${t.status}, completed: ${t.quantity_completed ?? 0}, rejected: ${t.quantity_rejected ?? 0}`
      }),
      "",
      `QC checks: ${qcChecks.length} inspections, total failed: ${qcChecks.reduce((s, q) => s + (q.quantity_failed ?? 0), 0)}`,
      costing ? `Costing: material ₹${costing.material_cost}, labor ₹${costing.labor_cost}, overhead ₹${costing.overhead_cost}, total ₹${costing.total_cost}` : "Costing: not yet done",
    ].join("\n")

    const raw = await askGemini(ORDER_SUMMARY_PROMPT, orderContext)
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    const parsed = JSON.parse(cleaned)

    return { summary: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI summary unavailable"
    return { error: msg }
  }
}

// ===== Voice Chat (Sarvam STT → Chat → TTS) =====

const TTS_SUPPORTED_LANGS = [
  "hi-IN", "bn-IN", "ta-IN", "te-IN", "kn-IN",
  "ml-IN", "mr-IN", "gu-IN", "pa-IN", "od-IN", "en-IN",
]

function toTTSLang(sttLang: string | null): string {
  if (!sttLang) return "en-IN"
  if (TTS_SUPPORTED_LANGS.includes(sttLang)) return sttLang
  return "en-IN"
}

export async function transcribeAudio(
  base64Audio: string
): Promise<{ transcript: string; languageCode: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }
    if (!rateLimit(`ai_voice:${user.id}`, 10, 60_000)) {
      return { error: "Too many requests — please wait a minute and try again." }
    }

    const buffer = Buffer.from(base64Audio, "base64")
    const result = await speechToText(buffer, "recording.webm")
    return {
      transcript: result.transcript,
      languageCode: result.language_code ?? "en-IN",
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speech recognition failed"
    return { error: msg }
  }
}

export async function synthesizeSpeech(
  text: string,
  languageCode: string = "en-IN"
): Promise<{ audioBase64: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const lang = toTTSLang(languageCode)
    const result = await textToSpeech(text, lang)
    return { audioBase64: result.audioBase64 }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speech synthesis failed"
    return { error: msg }
  }
}

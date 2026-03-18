/**
 * WhatsApp owner digest via Twilio.
 * Requires in .env.local:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_WHATSAPP_FROM  — e.g. whatsapp:+14155238886
 *   OWNER_WHATSAPP        — e.g. whatsapp:+919876543210
 */

import twilio from "twilio"

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

export interface WhatsAppResult {
  success: boolean
  error?: string
}

export async function sendWhatsApp(body: string): Promise<WhatsAppResult> {
  const client = getClient()
  if (!client) {
    console.warn("[whatsapp] Twilio credentials not set — skipping")
    return { success: false, error: "Twilio credentials not configured" }
  }

  const from = process.env.TWILIO_WHATSAPP_FROM
  const to = process.env.OWNER_WHATSAPP
  if (!from || !to) {
    return { success: false, error: "TWILIO_WHATSAPP_FROM or OWNER_WHATSAPP not set" }
  }

  try {
    await client.messages.create({ from, to, body })
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[whatsapp] send failed:", msg)
    return { success: false, error: msg }
  }
}

export async function sendOwnerDailyDigest(data: {
  date: string
  activeOrders: number
  pendingLeaves: number
  overdueInvoices: number
  overdueAmount: number
  lowStockItems: number
  todayAttendance: number
  totalWorkers: number
}): Promise<WhatsAppResult> {
  const lines = [
    `📊 *JUST CLOTHING — Daily Digest*`,
    `📅 ${data.date}`,
    ``,
    `🏭 *Operations*`,
    `• Active Orders: ${data.activeOrders}`,
    `• Attendance: ${data.todayAttendance}/${data.totalWorkers} workers`,
    `• Pending Leave Requests: ${data.pendingLeaves}`,
    ``,
    `💰 *Finance*`,
    `• Overdue Invoices: ${data.overdueInvoices}${data.overdueAmount > 0 ? ` (₹${data.overdueAmount.toLocaleString("en-IN")})` : ""}`,
    ``,
    `📦 *Inventory*`,
    `• Low Stock Items: ${data.lowStockItems}`,
    ``,
    `_Sent by KYRE · JUST CLOTHING ERP_`,
  ]

  return sendWhatsApp(lines.join("\n"))
}

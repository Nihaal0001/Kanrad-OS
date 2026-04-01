/**
 * Email notifications via Resend.
 * Requires: RESEND_API_KEY in .env.local
 * From address: notifications@yourdomain.com (configure in Resend dashboard)
 */

import { Resend } from "resend"

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

const FROM = process.env.EMAIL_FROM || "KANRAD ERP <notifications@kanraderp.in>"
const OWNER_EMAIL = process.env.OWNER_EMAIL || ""

export interface EmailResult {
  success: boolean
  error?: string
}

// Generic send helper — all emails go through here
async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
}): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email")
    return { success: false, error: "RESEND_API_KEY not configured" }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.error("[email] send failed:", msg)
    return { success: false, error: msg }
  }
}

// ── Notification templates ───────────────────────────────────────────────────

export async function sendLowStockAlert(items: {
  name: string
  sku: string
  current_stock: number
  min_stock_level: number
  unit: string
}[]) {
  if (!OWNER_EMAIL || items.length === 0) return { success: false, error: "No recipient or no items" }

  const rows = items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${esc(i.name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace">${esc(i.sku)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:600">${esc(String(i.current_stock))} ${esc(i.unit)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${esc(String(i.min_stock_level))} ${esc(i.unit)}</td>
        </tr>`
    )
    .join("")

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#c2622a;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">⚠️ Low Stock Alert</h1>
        <p style="color:#fde4d3;margin:4px 0 0;font-size:14px">KANRAD ERP — Inventory Management</p>
      </div>
      <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#374151;font-size:15px">${items.length} material${items.length > 1 ? "s are" : " is"} below minimum stock level:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9f5f2">
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Material</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">SKU</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Current</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Minimum</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:20px;font-size:13px;color:#9ca3af">Raise a Purchase Order to replenish stock.</p>
      </div>
    </div>
  `

  return sendEmail({ to: OWNER_EMAIL, subject: `[KANRAD ERP] Low Stock Alert — ${items.length} item${items.length > 1 ? "s" : ""}`, html })
}

export async function sendOverdueInvoiceAlert(invoices: {
  invoice_number: string
  customer_name: string
  total_amount: number
  due_date: string
  outstanding: number
}[]) {
  if (!OWNER_EMAIL || invoices.length === 0) return { success: false, error: "No recipient or no invoices" }

  const rows = invoices
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-family:monospace">${esc(i.invoice_number)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${esc(i.customer_name)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6">${esc(i.due_date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#dc2626;font-weight:600">₹${esc(i.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 }))}</td>
        </tr>`
    )
    .join("")

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#c2622a;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">🔴 Overdue Invoices</h1>
        <p style="color:#fde4d3;margin:4px 0 0;font-size:14px">KANRAD ERP — Finance</p>
      </div>
      <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="color:#374151;font-size:15px">${invoices.length} invoice${invoices.length > 1 ? "s are" : " is"} overdue:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f9f5f2">
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Invoice</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Customer</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Due</th>
              <th style="padding:8px 12px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Outstanding</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `

  return sendEmail({ to: OWNER_EMAIL, subject: `[KANRAD ERP] ${invoices.length} Overdue Invoice${invoices.length > 1 ? "s" : ""}`, html })
}

export async function sendLeaveRequestNotification(opts: {
  workerName: string
  leaveType: string
  startDate: string
  endDate: string
  reason?: string
}) {
  if (!OWNER_EMAIL) return { success: false, error: "No recipient configured" }

  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#c2622a;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">📋 New Leave Request</h1>
        <p style="color:#fde4d3;margin:4px 0 0;font-size:14px">KANRAD ERP — HR</p>
      </div>
      <div style="background:#fff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6b7280;width:140px">Worker</td><td style="padding:8px 0;font-weight:600">${esc(opts.workerName)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">Leave Type</td><td style="padding:8px 0">${esc(opts.leaveType)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">From</td><td style="padding:8px 0">${esc(opts.startDate)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280">To</td><td style="padding:8px 0">${esc(opts.endDate)}</td></tr>
          ${opts.reason ? `<tr><td style="padding:8px 0;color:#6b7280">Reason</td><td style="padding:8px 0">${esc(opts.reason)}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;font-size:13px;color:#9ca3af">Visit the HR → Leaves page to approve or reject.</p>
      </div>
    </div>
  `

  return sendEmail({ to: OWNER_EMAIL, subject: `[KANRAD ERP] Leave Request — ${opts.workerName}`, html })
}

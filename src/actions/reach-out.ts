"use server"

import { z } from "zod"
import { Resend } from "resend"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  phone: z.string().max(20).optional().or(z.literal("")),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
  priority: z.enum(["medium", "high", "critical"]),
})

export type ReachOutFormData = z.infer<typeof schema>

const PRIORITY_LABELS: Record<string, string> = {
  medium: "Medium",
  high: "High",
  critical: "Critical",
}

const PRIORITY_COLORS: Record<string, string> = {
  medium: "#6366f1",
  high: "#f59e0b",
  critical: "#dc2626",
}

export async function submitReachOut(formData: ReachOutFormData) {
  const parsed = schema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const d = parsed.data
  const priorityColor = PRIORITY_COLORS[d.priority]
  const priorityLabel = PRIORITY_LABELS[d.priority]

  const ownerEmail = process.env.OWNER_EMAIL
  if (!ownerEmail || !process.env.RESEND_API_KEY) {
    return { success: true }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM = process.env.EMAIL_FROM || "KANRAD ERP <notifications@kanraderp.in>"

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0f172a;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="color:#fff;margin:0;font-size:20px">New Support Ticket — KANRAD ERP</h1>
      </div>
      <div style="background:#f8fafc;padding:24px 32px;border:1px solid #e2e8f0;border-top:none">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px;width:120px">From</td>
            <td style="padding:8px 0;font-weight:600">${d.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px">Email</td>
            <td style="padding:8px 0"><a href="mailto:${d.email}" style="color:#6366f1">${d.email}</a></td>
          </tr>
          ${d.phone ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Phone</td><td style="padding:8px 0">${d.phone}</td></tr>` : ""}
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px">Priority</td>
            <td style="padding:8px 0">
              <span style="background:${priorityColor}20;color:${priorityColor};padding:2px 10px;border-radius:99px;font-size:12px;font-weight:600">${priorityLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#64748b;font-size:13px">Subject</td>
            <td style="padding:8px 0;font-weight:600">${d.subject}</td>
          </tr>
        </table>

        <div style="margin-top:16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
          <p style="margin:0;color:#64748b;font-size:12px;margin-bottom:8px">MESSAGE</p>
          <p style="margin:0;white-space:pre-wrap;color:#0f172a">${d.message}</p>
        </div>
      </div>
      <div style="background:#f1f5f9;padding:12px 32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;font-size:12px;color:#94a3b8">
        Submitted via KANRAD ERP Reach Out
      </div>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: ownerEmail,
    subject: `[${priorityLabel}] ${d.subject} — from ${d.name}`,
    html,
  })

  return { success: true }
}

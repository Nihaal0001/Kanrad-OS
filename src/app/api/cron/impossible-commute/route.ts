import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { askGemini } from "@/lib/ai/gemini"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  // 1. Verify cron secret
  const auth = request.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()

  // 2. Get yesterday's date range
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toISOString().split("T")[0]

  // 3. Fetch all QR logs from yesterday
  const { data: logs, error } = await admin
    .from("qr_attendance_logs")
    .select("id, employee_id, timestamp, type, status, lat, long")
    .gte("timestamp", `${dateStr}T00:00:00Z`)
    .lt("timestamp", `${dateStr}T23:59:59Z`)
    .order("timestamp", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!logs || logs.length < 2) {
    return NextResponse.json({ ok: true, suspicious_pairs: 0, message: "Not enough logs to analyze" })
  }

  // 4. Detect anomalies: same employee checking in multiple times within 2 minutes
  const suspicious: { employee_id: string; timestamps: string[]; types: string[] }[] = []

  // Group by employee
  const byEmployee = new Map<string, typeof logs>()
  for (const log of logs) {
    const existing = byEmployee.get(log.employee_id) ?? []
    existing.push(log)
    byEmployee.set(log.employee_id, existing)
  }

  for (const [empId, empLogs] of byEmployee) {
    for (let i = 1; i < empLogs.length; i++) {
      const prev = new Date(empLogs[i - 1].timestamp).getTime()
      const curr = new Date(empLogs[i].timestamp).getTime()
      const diffSec = Math.abs(curr - prev) / 1000

      if (diffSec < 120) {
        suspicious.push({
          employee_id: empId,
          timestamps: [empLogs[i - 1].timestamp, empLogs[i].timestamp],
          types: [empLogs[i - 1].type, empLogs[i].type],
        })
      }
    }
  }

  // Also detect flagged entries (geofence violations)
  const flagged = logs.filter((l) => l.status === "Flagged")

  if (suspicious.length === 0 && flagged.length === 0) {
    return NextResponse.json({ ok: true, suspicious_pairs: 0, message: "No anomalies found" })
  }

  // 5. Get employee names for context
  const empIds = [
    ...new Set([
      ...suspicious.map((s) => s.employee_id),
      ...flagged.map((f) => f.employee_id),
    ]),
  ]

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .in("id", empIds)

  const nameMap = new Map<string, string>()
  for (const p of profiles ?? []) {
    nameMap.set(p.id, p.full_name)
  }

  // 6. Build context for Gemini
  let context = `Attendance anomaly report for ${dateStr}:\n\n`

  if (suspicious.length > 0) {
    context += "RAPID SUCCESSIVE SCANS (same employee, <2 min apart):\n"
    for (const s of suspicious) {
      const name = nameMap.get(s.employee_id) ?? "Unknown"
      context += `- ${name}: ${s.types.join(" then ")} at ${s.timestamps.map((t) => new Date(t).toLocaleTimeString("en-IN")).join(" and ")}\n`
    }
    context += "\n"
  }

  if (flagged.length > 0) {
    context += "GEOFENCE VIOLATIONS (scanned from outside office radius):\n"
    for (const f of flagged) {
      const name = nameMap.get(f.employee_id) ?? "Unknown"
      context += `- ${name}: ${f.type} at ${new Date(f.timestamp).toLocaleTimeString("en-IN")}\n`
    }
  }

  // 7. Ask Gemini for analysis
  let report = context
  try {
    const geminiResponse = await askGemini(
      "You are an HR analyst for JUST CLOTHING garment factory. Analyze attendance anomalies and write a concise, actionable report for the factory manager. Be specific about concerns and recommendations.",
      context
    )
    report = geminiResponse
  } catch {
    // Use raw context if Gemini fails
  }

  // 8. Create notification for admins
  await admin.from("notifications").insert({
    type: "attendance_anomaly",
    title: `Attendance Anomalies — ${dateStr}`,
    message: report.slice(0, 500),
    reference_type: "qr_attendance_logs",
    is_read: false,
  })

  return NextResponse.json({
    ok: true,
    suspicious_pairs: suspicious.length,
    flagged_entries: flagged.length,
  })
}

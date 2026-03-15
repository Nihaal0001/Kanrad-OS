"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { validateToken } from "@/lib/qr-token"
import { haversineDistance } from "@/lib/geo"

interface VerifyInput {
  token: string
  lat: number
  long: number
}

interface VerifyResult {
  type: "IN" | "OUT"
  status: "Verified" | "Flagged"
  flag_reason: string | null
  employee_name: string
  timestamp: string
}

export async function verifyAndRecordAttendance(
  input: VerifyInput
): Promise<{ data?: VerifyResult; error?: string }> {
  const { token, lat, long } = input

  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get employee profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("auth_id", user.id)
    .single()

  if (profileErr || !profile) return { error: "Employee profile not found" }

  // 2. Validate TOTP token
  if (!validateToken(token)) {
    return { error: "QR code expired — please scan the latest code" }
  }

  // 3. Geofence check
  const admin = createAdminClient()
  const { data: locationSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "office_location")
    .maybeSingle()

  let flagReason: string | null = null
  const officeLoc = locationSetting?.value as {
    lat: number
    long: number
    radius_m: number
  } | null

  if (officeLoc && officeLoc.lat !== 0 && officeLoc.long !== 0) {
    const dist = haversineDistance(lat, long, officeLoc.lat, officeLoc.long)
    if (dist > officeLoc.radius_m) {
      flagReason = `Outside geofence — ${Math.round(dist)}m from office (limit: ${officeLoc.radius_m}m)`
    }
  }

  // 4. Determine IN/OUT
  const today = new Date().toISOString().split("T")[0]
  const { data: lastLog } = await admin
    .from("qr_attendance_logs")
    .select("type")
    .eq("employee_id", profile.id)
    .gte("timestamp", `${today}T00:00:00Z`)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle()

  const type: "IN" | "OUT" =
    !lastLog || lastLog.type === "OUT" ? "IN" : "OUT"

  // 5. Insert QR log
  const now = new Date()
  const { error: insertErr } = await admin
    .from("qr_attendance_logs")
    .insert({
      employee_id: profile.id,
      type,
      status: flagReason ? "Flagged" : "Verified",
      lat,
      long,
      flag_reason: flagReason,
      timestamp: now.toISOString(),
    })

  if (insertErr) return { error: insertErr.message }

  // 6. Upsert into existing attendance table for compatibility
  const nowTime = now.toTimeString().slice(0, 5) // "HH:MM"

  // Fetch existing attendance row to preserve check_in on OUT scans
  const { data: existing } = await admin
    .from("attendance")
    .select("check_in, check_out")
    .eq("worker_id", profile.id)
    .eq("date", today)
    .maybeSingle()

  await admin.from("attendance").upsert(
    {
      worker_id: profile.id,
      date: today,
      status: "present",
      check_in:
        type === "IN" && !existing?.check_in
          ? nowTime
          : (existing?.check_in ?? nowTime),
      check_out: type === "OUT" ? nowTime : (existing?.check_out ?? null),
    },
    { onConflict: "worker_id,date" }
  )

  revalidatePath("/hr/attendance")

  return {
    data: {
      type,
      status: flagReason ? "Flagged" : "Verified",
      flag_reason: flagReason,
      employee_name: profile.full_name,
      timestamp: now.toISOString(),
    },
  }
}

"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function saveOrgSettings(formData: FormData) {
  const supabase = await createClient()

  // Finding #15 — require authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const settings = {
    org_name: (formData.get("org_name") as string) || "KANRAD ERP",
    org_type: (formData.get("org_type") as string) || "",
    gstin: (formData.get("gstin") as string) || "",
    address: (formData.get("address") as string) || "",
    city: (formData.get("city") as string) || "",
    state: (formData.get("state") as string) || "",
    pincode: (formData.get("pincode") as string) || "",
    phone: (formData.get("phone") as string) || "",
    email: (formData.get("email") as string) || "",
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "org", value: settings }, { onConflict: "key" })

  if (error) return { error: error.message }

  revalidatePath("/settings")
}

export async function getOrgSettings() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "org")
    .maybeSingle()

  return (data?.value as Record<string, string>) ?? null
}

// ===== Office Location =====

export async function getOfficeLocation() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "office_location")
    .maybeSingle()

  return (data?.value as { lat: number; long: number; radius_m: number }) ?? null
}

export async function saveOfficeLocation(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Admin guard
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()
  if (profile?.role !== "admin") return { error: "Admin access required" }

  const lat = parseFloat(formData.get("lat") as string)
  const long = parseFloat(formData.get("long") as string)
  const radius_m = parseInt(formData.get("radius_m") as string, 10)

  if (isNaN(lat) || isNaN(long) || isNaN(radius_m)) {
    return { error: "Invalid coordinates or radius" }
  }
  if (lat < -90 || lat > 90 || long < -180 || long > 180) {
    return { error: "Coordinates out of range" }
  }
  if (radius_m < 10 || radius_m > 1000) {
    return { error: "Radius must be between 10 and 1000 metres" }
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "office_location", value: { lat, long, radius_m } }, { onConflict: "key" })

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

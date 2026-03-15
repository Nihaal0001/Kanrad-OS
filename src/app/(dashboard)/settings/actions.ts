"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function saveOrgSettings(formData: FormData) {
  const supabase = await createClient()

  // Finding #15 — require authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const settings = {
    org_name: (formData.get("org_name") as string) || "JUST CLOTHING",
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

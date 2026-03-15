"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { buyerSchema, type BuyerFormData } from "@/lib/validators/buyer"

export async function getBuyers(search?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("buyers")
    .select("*")
    .order("created_at", { ascending: false })

  if (search) {
    const escaped = search.replace(/%/g, "\\%").replace(/_/g, "\\_")
    query = query.or(`name.ilike.%${escaped}%,company.ilike.%${escaped}%,email.ilike.%${escaped}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function getBuyer(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("buyers")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function createBuyer(formData: BuyerFormData) {
  const validated = buyerSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Clean empty strings to null
  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("buyers")
    .insert(cleaned)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/orders")
  return { data }
}

export async function updateBuyer(id: string, formData: BuyerFormData) {
  const validated = buyerSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("buyers")
    .update(cleaned)
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/orders")
  return { data }
}

export async function deleteBuyer(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase.from("buyers").delete().eq("id", id)

  if (error) return { error: error.message }

  revalidatePath("/orders")
  return { success: true }
}

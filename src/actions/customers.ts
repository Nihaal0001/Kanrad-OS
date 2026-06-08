"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { customerSchema, type CustomerFormData } from "@/lib/validators/contacts"
import { logAudit } from "@/actions/audit"

export const getCustomers = unstable_cache(
  async (filters?: { search?: string; active?: boolean }) => {
    const supabase = createAdminClient()
    let query = supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true })

    if (filters?.active !== false) query = query.eq("is_active", true)
    if (filters?.search) {
      const escaped = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_")
      query = query.or(`name.ilike.%${escaped}%,company.ilike.%${escaped}%,gstin.ilike.%${escaped}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return data ?? []
  },
  ["customers"],
  { tags: ["customers"], revalidate: 300 }
)

export const getCustomer = (id: string) =>
  unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    [`customer-${id}`],
    { tags: ["customers"], revalidate: 60 }
  )()

export async function createCustomer(formData: CustomerFormData) {
  const validated = customerSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("customers")
    .insert(cleaned)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("customers", {})
  revalidatePath("/customers")
  await logAudit({ entityType: "customer", entityId: data.id, entityLabel: data.name, action: "created" })
  return { data }
}

export async function updateCustomer(id: string, formData: CustomerFormData) {
  const validated = customerSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("customers")
    .update({ ...cleaned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("customers", {})
  revalidatePath("/customers")
  revalidatePath(`/customers/${id}`)
  await logAudit({ entityType: "customer", entityId: id, entityLabel: data.name, action: "updated" })
  return { data }
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("customers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("customers", {})
  revalidatePath("/customers")
  await logAudit({ entityType: "customer", entityId: id, action: "deleted" })
  return { success: true }
}

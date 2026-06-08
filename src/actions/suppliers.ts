"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { supplierSchema, type SupplierFormData } from "@/lib/validators/contacts"
import { logAudit } from "@/actions/audit"

export const getSuppliers = unstable_cache(
  async (filters?: { search?: string; active?: boolean }) => {
    const supabase = createAdminClient()
    let query = supabase
      .from("suppliers")
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
  ["suppliers"],
  { tags: ["suppliers"], revalidate: 300 }
)

export const getSupplier = (id: string) =>
  unstable_cache(
    async () => {
      const supabase = createAdminClient()
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw new Error(error.message)
      return data
    },
    [`supplier-${id}`],
    { tags: ["suppliers"], revalidate: 60 }
  )()

export async function createSupplier(formData: SupplierFormData) {
  const validated = supplierSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("suppliers")
    .insert(cleaned)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("suppliers", {})
  revalidatePath("/suppliers")
  await logAudit({ entityType: "supplier", entityId: data.id, entityLabel: data.name, action: "created" })
  return { data }
}

export async function updateSupplier(id: string, formData: SupplierFormData) {
  const validated = supplierSchema.parse(formData)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const cleaned = Object.fromEntries(
    Object.entries(validated).map(([k, v]) => [k, v === "" ? null : v])
  )

  const { data, error } = await supabase
    .from("suppliers")
    .update({ ...cleaned, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTag("suppliers", {})
  revalidatePath("/suppliers")
  revalidatePath(`/suppliers/${id}`)
  await logAudit({ entityType: "supplier", entityId: id, entityLabel: data.name, action: "updated" })
  return { data }
}

export async function deleteSupplier(id: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { error } = await supabase
    .from("suppliers")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return { error: error.message }

  revalidateTag("suppliers", {})
  revalidatePath("/suppliers")
  await logAudit({ entityType: "supplier", entityId: id, action: "deleted" })
  return { success: true }
}

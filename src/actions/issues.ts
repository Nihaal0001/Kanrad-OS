"use server"

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logAudit } from "@/actions/audit"
import { issueSchema } from "@/lib/validators/issues"
import type { IssueFormData } from "@/lib/validators/issues"

const VALID_STATUSES = ["open", "in_progress", "resolved"] as const

// ── Queries ──────────────────────────────────────────────────

export const getIssues = (filters?: { status?: string; severity?: string }) =>
  unstable_cache(
    async () => {
      const supabase = createAdminClient()
      let query = supabase
        .from("issues")
        .select("*")
        .order("created_at", { ascending: false })

      if (filters?.status) query = query.eq("status", filters.status)
      if (filters?.severity) query = query.eq("severity", filters.severity)

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return data ?? []
    },
    [`issues-${filters?.status ?? "all"}-${filters?.severity ?? "all"}`],
    { tags: ["issues"], revalidate: 60 }
  )()

// ── Mutations ────────────────────────────────────────────────

export async function createIssue(formData: IssueFormData) {
  const validated = issueSchema.parse(formData)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data, error } = await supabase
    .from("issues")
    .insert({
      module: validated.module,
      issue_type: validated.issue_type,
      description: validated.description,
      severity: validated.severity,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "issue",
    entityId: data.id,
    entityLabel: `${validated.module}: ${validated.issue_type}`,
    action: "created",
    newValues: { module: validated.module, severity: validated.severity },
  })

  revalidateTag("issues", {})
  revalidatePath("/issues")
  return { data }
}

export async function updateIssueStatus(id: string, status: string) {
  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    return { error: "Invalid status" }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const resolved_at = status === "resolved" ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from("issues")
    .update({
      status,
      resolved_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return { error: error.message }

  void logAudit({
    entityType: "issue",
    entityId: id,
    entityLabel: `${data.module}: ${data.issue_type}`,
    action: "status_changed",
    newValues: { status },
  })

  revalidateTag("issues", {})
  revalidatePath("/issues")
  return { success: true }
}

"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/actions/audit"

// ── Validators ───────────────────────────────────────────────

export const issueSchema = z.object({
  module: z.string().min(1, "Module is required"),
  issue_type: z.string().min(1, "Issue type is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  severity: z.enum(["medium", "high", "critical"]),
})

export type IssueFormData = z.infer<typeof issueSchema>

const VALID_STATUSES = ["open", "in_progress", "resolved"] as const

// ── Queries ──────────────────────────────────────────────────

export async function getIssues(filters?: { status?: string; severity?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.severity) query = query.eq("severity", filters.severity)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

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

  revalidatePath("/issues")
  return { success: true }
}

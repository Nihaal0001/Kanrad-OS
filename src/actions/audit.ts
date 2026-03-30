"use server"

import { createClient } from "@/lib/supabase/server"
import type { AuditAction } from "@/lib/validators/audit"

// Re-export for other modules
export type { AuditAction } from "@/lib/validators/audit"

/**
 * Log an audit entry. Call this from other server actions after a successful mutation.
 * Non-throwing — audit failures should never block the primary operation.
 */
export async function logAudit({
  entityType,
  entityId,
  entityLabel,
  action,
  oldValues,
  newValues,
}: {
  entityType: string
  entityId?: string
  entityLabel?: string
  action: AuditAction
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let changedByName: string | null = null
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("auth_id", user.id)
        .maybeSingle()
      changedByName = profile?.full_name ?? user.email ?? null
    }

    await supabase.from("audit_logs").insert({
      entity_type: entityType,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      action,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      changed_by: user?.id ?? null,
      changed_by_name: changedByName,
    })
  } catch {
    // Audit errors are silent — never block main operations
  }
}

export async function getAuditLogs(filters?: {
  entityType?: string
  entityId?: string
  action?: string
  from?: string
  to?: string
  limit?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 200)

  if (filters?.entityType) query = query.eq("entity_type", filters.entityType)
  if (filters?.entityId) query = query.eq("entity_id", filters.entityId)
  if (filters?.action) query = query.eq("action", filters.action)
  if (filters?.from) query = query.gte("created_at", filters.from)
  if (filters?.to) query = query.lte("created_at", filters.to + "T23:59:59Z")

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getAuditLogsForEntity(entityType: string, entityId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

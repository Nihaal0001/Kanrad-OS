"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { userRoles, type UserRole } from "@/lib/constants"
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions"

export type { UserRow } from "@/lib/validators/users"

// Finding #3 — admin-only helper; checks role via profiles table
async function requireAdmin(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") return { error: "Forbidden: admin only" }
  return { supabase, userId: user.id }
}

export async function getUsers(): Promise<UserRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, department, is_active, created_at")
    .order("full_name")

  if (error) throw new Error(error.message)
  return (data ?? []) as UserRow[]
}

export async function updateUserRole(
  id: string,
  role: string
): Promise<{ error?: string } | { success: boolean }> {
  if (!userRoles.includes(role as UserRole)) return { error: "Invalid role" }

  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const { supabase } = auth

  const { error } = await supabase.from("profiles").update({ role }).eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/users")
  return { success: true }
}

export async function toggleUserActive(
  id: string,
  is_active: boolean
): Promise<{ error?: string } | { success: boolean }> {
  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const { supabase } = auth

  const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/users")
  return { success: true }
}

// ── Role permissions (DB-backed) ────────────────────────────────────────────

export async function getAllRolePermissions(): Promise<Record<string, string[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("role_permissions")
    .select("role, permission")

  if (error) {
    // Fallback to hardcoded defaults if table doesn't exist yet
    return Object.fromEntries(
      userRoles.map((r) => [r, [...(DEFAULT_ROLE_PERMISSIONS[r] ?? [])]])
    )
  }

  const result: Record<string, string[]> = Object.fromEntries(userRoles.map((r) => [r, []]))
  for (const row of data ?? []) {
    result[row.role] ??= []
    result[row.role].push(row.permission)
  }
  return result
}

export async function getRolePermissions(role: string): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", role)

  if (error) {
    return [...(DEFAULT_ROLE_PERMISSIONS[role as UserRole] ?? [])]
  }
  return data?.map((r) => r.permission) ?? []
}

export async function toggleRolePermission(
  role: string,
  permission: string,
  enabled: boolean
): Promise<{ error?: string } | { success: boolean }> {
  // Guard: admin must always keep user management access
  if (role === "admin" && permission === "users" && !enabled) {
    return { error: "Cannot remove User Management from Admin — this would lock everyone out." }
  }

  const auth = await requireAdmin()
  if ("error" in auth) return auth
  const { supabase } = auth

  if (enabled) {
    const { error } = await supabase
      .from("role_permissions")
      .upsert({ role, permission }, { onConflict: "role,permission" })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role", role)
      .eq("permission", permission)
    if (error) return { error: error.message }
  }

  revalidatePath("/users")
  return { success: true }
}

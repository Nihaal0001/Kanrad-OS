import { redirect } from "next/navigation"
import { Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { getUsers, getAllRolePermissions } from "@/actions/users"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { UsersTable } from "@/components/users/users-table"
import { PermissionsMatrix } from "@/components/users/permissions-matrix"
import { CreateUserSheet } from "@/components/users/create-user-sheet"

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Check the current user's role permissions — only those with 'users' access can view this page
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("auth_id", user.id)
    .maybeSingle()

  const { data: perms } = await supabase
    .from("role_permissions")
    .select("permission")
    .eq("role", profile?.role ?? "worker")

  const allowed = perms?.map((p) => p.permission) ?? []
  if (!allowed.includes("users")) redirect("/")

  const [users, allPermissions] = await Promise.all([
    getUsers(),
    getAllRolePermissions(),
  ])

  const activeCount = users.filter((u) => u.is_active).length

  return (
    <>
      <PageHeader
        title="Users"
        description={`${activeCount} active team member${activeCount !== 1 ? "s" : ""}`}
        breadcrumbs={[{ label: "Users" }]}
      >
        <CreateUserSheet />
      </PageHeader>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No users yet"
          description="Users appear here when team members sign in for the first time"
        />
      ) : (
        <div className="space-y-8">
          <UsersTable users={users} currentUserId={profile!.id} />
          <PermissionsMatrix initialPermissions={allPermissions} />
        </div>
      )}
    </>
  )
}

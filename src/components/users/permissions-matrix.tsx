"use client"

import { useState, useTransition } from "react"
import { ChevronDown, Lock } from "lucide-react"
import { toast } from "sonner"

import { toggleRolePermission } from "@/actions/users"
import { PERMISSION_TREE, LEGACY_ONLY_FLAGS, type PermissionGroup } from "@/lib/permission-tree"
import { userRoles, type UserRole } from "@/lib/constants"
import { ROLE_LABELS } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface PermissionsMatrixProps {
  initialPermissions: Record<string, string[]>
}

export function PermissionsMatrix({ initialPermissions }: PermissionsMatrixProps) {
  const [permissions, setPermissions] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(
      Object.entries(initialPermissions).map(([role, perms]) => [role, new Set(perms)])
    )
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // admin+users is permanently locked — removing it locks everyone out
  function isLocked(role: string, permission: string) {
    return role === "admin" && permission === "users"
  }

  function handleToggle(role: string, permission: string) {
    if (isLocked(role, permission)) return

    const currentlyEnabled = permissions[role]?.has(permission) ?? false
    const newEnabled = !currentlyEnabled

    setPermissions((prev) => {
      const next = { ...prev, [role]: new Set(prev[role] ?? []) }
      if (newEnabled) next[role].add(permission)
      else next[role].delete(permission)
      return next
    })

    startTransition(async () => {
      const result = await toggleRolePermission(role, permission, newEnabled)
      if (result && "error" in result) {
        setPermissions((prev) => {
          const next = { ...prev, [role]: new Set(prev[role] ?? []) }
          if (currentlyEnabled) next[role].add(permission)
          else next[role].delete(permission)
          return next
        })
        toast.error(result.error)
      }
    })
  }

  function handleSelectAllInGroup(role: string, keys: string[]) {
    const roleSet = permissions[role] ?? new Set<string>()
    const allChecked = keys.every((k) => roleSet.has(k))
    const toggleKeys = keys.filter((k) => !isLocked(role, k) && roleSet.has(k) === allChecked)
    for (const key of toggleKeys) handleToggle(role, key)
  }

  function toggleGroupCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderRow(key: string, label: string, indent = false) {
    return (
      <tr key={key} className="hover:bg-muted/30 transition-colors">
        <td className={cn("py-2 pr-4 text-sm", indent ? "pl-6 text-muted-foreground" : "font-medium")}>
          {label}
        </td>
        {userRoles.map((role) => {
          const enabled = permissions[role]?.has(key) ?? false
          const locked = isLocked(role, key)
          return (
            <td key={role} className="px-2 py-2 text-center">
              <button
                onClick={() => handleToggle(role, key)}
                disabled={isPending || locked}
                title={locked ? "Cannot be removed" : enabled ? "Click to revoke" : "Click to grant"}
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold transition-all mx-auto",
                  locked && "cursor-not-allowed",
                  enabled && !locked && "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200 hover:border-emerald-400",
                  enabled && locked && "bg-emerald-100 border-emerald-300 text-emerald-700",
                  !enabled && !locked && "bg-muted border-border text-muted-foreground/40 hover:bg-accent hover:text-foreground hover:border-border",
                  isPending && "opacity-50"
                )}
              >
                {locked ? <Lock className="h-2.5 w-2.5 text-emerald-600" /> : enabled ? "✓" : "–"}
              </button>
            </td>
          )
        })}
      </tr>
    )
  }

  function renderGroup(group: PermissionGroup) {
    const groupKeys = [...(group.masterKey ? [group.masterKey] : []), ...group.leaves.map((l) => l.key)]
    const isCollapsed = collapsed.has(group.id)

    return (
      <>
        <tr key={`${group.id}-header`} className="bg-muted/40">
          <td colSpan={1} className="py-1.5 pr-4">
            <button
              type="button"
              onClick={() => toggleGroupCollapse(group.id)}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", isCollapsed && "-rotate-90")} />
              {group.title}
            </button>
          </td>
          {userRoles.map((role) => (
            <td key={role} className="px-2 py-1.5 text-center">
              <button
                type="button"
                onClick={() => handleSelectAllInGroup(role, groupKeys)}
                disabled={isPending}
                className="text-[10px] text-primary hover:underline"
              >
                All
              </button>
            </td>
          ))}
        </tr>
        {!isCollapsed && group.masterKey && renderRow(group.masterKey, `All ${group.title} pages`)}
        {!isCollapsed && group.leaves.map((leaf) => renderRow(leaf.key, leaf.label, true))}
      </>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role Permissions</CardTitle>
        <CardDescription>
          Click any cell to grant or revoke access to that page. Click a section header&apos;s &quot;All&quot; to
          grant/revoke everything in that section at once. The <Lock className="inline h-3 w-3 mx-0.5 mb-0.5" /> cell cannot be changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-48 py-2 pr-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Page
              </th>
              {userRoles.map((role) => (
                <th
                  key={role}
                  className="px-2 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {ROLE_LABELS[role as UserRole]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMISSION_TREE.map((group) => renderGroup(group))}
            <tr className="bg-muted/40">
              <td className="py-1.5 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Other
              </td>
              {userRoles.map((role) => <td key={role} />)}
            </tr>
            {LEGACY_ONLY_FLAGS.map((flag) => renderRow(flag.key, flag.label))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

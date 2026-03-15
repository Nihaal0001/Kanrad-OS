"use client"

import { useState, useTransition } from "react"
import { Lock } from "lucide-react"
import { toast } from "sonner"

import { toggleRolePermission } from "@/actions/users"
import { ALL_PERMISSIONS, MODULE_LABELS, ROLE_LABELS } from "@/lib/permissions"
import { userRoles, type UserRole } from "@/lib/constants"
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
  const [isPending, startTransition] = useTransition()

  // admin+users is permanently locked — removing it locks everyone out
  function isLocked(role: string, permission: string) {
    return role === "admin" && permission === "users"
  }

  function handleToggle(role: string, permission: string) {
    if (isLocked(role, permission)) return

    const currentlyEnabled = permissions[role]?.has(permission) ?? false
    const newEnabled = !currentlyEnabled

    // Optimistic update
    setPermissions((prev) => {
      const next = { ...prev, [role]: new Set(prev[role] ?? []) }
      if (newEnabled) next[role].add(permission)
      else next[role].delete(permission)
      return next
    })

    startTransition(async () => {
      const result = await toggleRolePermission(role, permission, newEnabled)
      if (result && "error" in result) {
        // Revert on failure
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role Permissions</CardTitle>
        <CardDescription>
          Click any cell to grant or revoke access. Changes apply on the user&apos;s next page load.
          The <Lock className="inline h-3 w-3 mx-0.5 mb-0.5" /> cell cannot be changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="w-44 py-2 pr-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Module
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
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm} className="hover:bg-muted/30 transition-colors">
                <td className="py-2.5 pr-4 text-sm font-medium">
                  {MODULE_LABELS[perm]}
                </td>
                {userRoles.map((role) => {
                  const enabled = permissions[role]?.has(perm) ?? false
                  const locked = isLocked(role, perm)

                  return (
                    <td key={role} className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => handleToggle(role, perm)}
                        disabled={isPending || locked}
                        title={locked ? "Cannot be removed" : enabled ? "Click to revoke" : "Click to grant"}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition-all mx-auto",
                          locked && "cursor-not-allowed",
                          enabled && !locked && "bg-emerald-100 border-emerald-300 text-emerald-700 hover:bg-emerald-200 hover:border-emerald-400",
                          enabled && locked && "bg-emerald-100 border-emerald-300 text-emerald-700",
                          !enabled && !locked && "bg-muted border-border text-muted-foreground/40 hover:bg-accent hover:text-foreground hover:border-border",
                          isPending && "opacity-50"
                        )}
                      >
                        {locked
                          ? <Lock className="h-3 w-3 text-emerald-600" />
                          : enabled ? "✓" : "–"
                        }
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

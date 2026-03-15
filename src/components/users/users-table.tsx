"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { updateUserRole, toggleUserActive, type UserRow } from "@/actions/users"
import { userRoles } from "@/lib/constants"
import { friendlyError } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  production_manager: "Production Manager",
  inventory_manager: "Inventory Manager",
  qc_head: "QC Head",
  floor_supervisor: "Floor Supervisor",
  worker: "Worker",
}

interface UsersTableProps {
  users: UserRow[]
  currentUserId: string
}

function UserRow({
  user,
  currentUserId,
}: {
  user: UserRow
  currentUserId: string
}) {
  const [isPending, startTransition] = useTransition()
  const isSelf = user.id === currentUserId

  function handleRoleChange(role: string) {
    startTransition(async () => {
      const result = await updateUserRole(user.id, role)
      if (result && "error" in result) {
        toast.error(friendlyError(result.error ?? "Failed to update role"))
      } else {
        toast.success(`${user.full_name}'s role updated to ${ROLE_LABELS[role] ?? role}`)
      }
    })
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleUserActive(user.id, !user.is_active)
      if (result && "error" in result) {
        toast.error(friendlyError(result.error ?? "Failed to update status"))
      } else {
        toast.success(user.is_active ? `${user.full_name} deactivated` : `${user.full_name} activated`)
      }
    })
  }

  return (
    <Card key={user.id} className={!user.is_active ? "opacity-60" : undefined}>
      <CardContent className="grid grid-cols-[1.5fr_1fr_1.5fr_80px_80px] items-center gap-4 p-4">
        {/* Name + email */}
        <div>
          <p className="text-sm font-medium">
            {user.full_name}
            {isSelf && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">(you)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
        </div>

        {/* Department */}
        <p className="text-sm text-muted-foreground">{user.department ?? "—"}</p>

        {/* Role selector */}
        <Select
          value={user.role}
          onValueChange={handleRoleChange}
          disabled={isPending || isSelf}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {userRoles.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status badge */}
        <Badge
          variant="outline"
          className={
            user.is_active
              ? "text-emerald-600 border-emerald-600/30 text-xs"
              : "text-muted-foreground text-xs"
          }
        >
          {user.is_active ? "Active" : "Inactive"}
        </Badge>

        {/* Toggle active */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleToggleActive}
          disabled={isPending || isSelf}
        >
          {user.is_active ? "Deactivate" : "Activate"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function UsersTable({ users, currentUserId }: UsersTableProps) {
  const [showInactive, setShowInactive] = useState(false)
  const visible = showInactive ? users : users.filter((u) => u.is_active)
  const inactiveCount = users.filter((u) => !u.is_active).length

  return (
    <div className="space-y-2">
      {/* Column headers */}
      <div className="hidden grid-cols-[1.5fr_1fr_1.5fr_80px_80px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
        <span>Name</span>
        <span>Department</span>
        <span>Role</span>
        <span>Status</span>
        <span />
      </div>

      {visible.map((user) => (
        <UserRow key={user.id} user={user} currentUserId={currentUserId} />
      ))}

      {inactiveCount > 0 && (
        <button
          onClick={() => setShowInactive((v) => !v)}
          className="w-full pt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showInactive ? "Hide" : `Show ${inactiveCount} inactive`} user{inactiveCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  )
}

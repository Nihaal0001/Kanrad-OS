"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { updateUserDepartments, toggleUserActive, type UserRow } from "@/actions/users"
import { friendlyError } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PermissionPicker } from "@/components/users/permission-picker"
import { LABEL_BY_KEY } from "@/lib/permission-tree"

interface UsersTableProps {
  users: UserRow[]
  currentUserId: string
}

function UserRow({ user, currentUserId }: { user: UserRow; currentUserId: string }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const isSelf = user.id === currentUserId
  const isAdmin = user.role === "admin"

  const currentDepts = user.department ? user.department.split(",").map((d) => d.trim()).filter(Boolean) : []
  const [selected, setSelected] = useState<string[]>(currentDepts)

  function handleSave() {
    startTransition(async () => {
      const result = await updateUserDepartments(user.id, selected)
      if (result && "error" in result) {
        toast.error(friendlyError(result.error ?? "Failed to update"))
      } else {
        toast.success(`${user.full_name}'s access updated`)
        setEditing(false)
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
    <Card className={!user.is_active ? "opacity-60" : undefined}>
      <CardContent className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {user.full_name}
              {isSelf && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(you)</span>}
              {isAdmin && <span className="ml-2 text-[11px] font-normal text-purple-400">Admin</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={user.is_active ? "text-emerald-600 border-emerald-600/30 text-xs" : "text-muted-foreground text-xs"}
            >
              {user.is_active ? "Active" : "Inactive"}
            </Badge>
            {!isSelf && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={handleToggleActive} disabled={isPending}>
                {user.is_active ? "Deactivate" : "Activate"}
              </Button>
            )}
          </div>
        </div>

        {/* Tabs access */}
        {isAdmin ? (
          <p className="text-xs text-purple-400">Full access to all tabs</p>
        ) : !editing ? (
          <div className="flex flex-wrap gap-1.5 items-center">
            {currentDepts.length > 0 ? currentDepts.map((d) => {
              const label = LABEL_BY_KEY.get(d)
              return label ? (
                <Badge key={d} variant="secondary" className="text-xs">{label}</Badge>
              ) : null
            }) : (
              <span className="text-xs text-muted-foreground">No access set</span>
            )}
            {!isSelf && (
              <button onClick={() => { setSelected(currentDepts); setEditing(true) }} className="text-xs text-primary hover:underline ml-1">
                Edit
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <PermissionPicker selected={selected} onChange={setSelected} />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
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
      {visible.map((user) => (
        <UserRow key={user.id} user={user} currentUserId={currentUserId} />
      ))}
      {inactiveCount > 0 && (
        <button onClick={() => setShowInactive((v) => !v)} className="w-full pt-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {showInactive ? "Hide" : `Show ${inactiveCount} inactive`} user{inactiveCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  )
}

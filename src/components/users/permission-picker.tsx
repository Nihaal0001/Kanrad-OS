"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

import { PERMISSION_TREE, LEGACY_ONLY_FLAGS } from "@/lib/permission-tree"
import { cn } from "@/lib/utils"

interface PermissionPickerProps {
  selected: string[]
  onChange: (next: string[]) => void
}

function Chip({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium leading-tight transition-colors",
        checked ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 text-foreground"
      )}
    >
      <div className={cn(
        "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
        checked ? "border-primary bg-primary" : "border-muted-foreground"
      )}>
        {checked && (
          <svg className="h-2.5 w-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span>{label}</span>
    </button>
  )
}

/** Full nav-tree access picker — every main sidebar heading (section) and
 *  every sub-page under it, individually toggleable. Shared by the per-role
 *  matrix and the per-user editor so both stay generated from one source. */
export function PermissionPicker({ selected, onChange }: PermissionPickerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const selectedSet = new Set(selected)

  function toggle(key: string) {
    onChange(selectedSet.has(key) ? selected.filter((s) => s !== key) : [...selected, key])
  }

  function toggleGroupCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllInGroup(keys: string[]) {
    const allSelected = keys.every((k) => selectedSet.has(k))
    onChange(allSelected ? selected.filter((s) => !keys.includes(s)) : [...new Set([...selected, ...keys])])
  }

  return (
    <div className="space-y-4">
      {PERMISSION_TREE.map((group) => {
        const groupKeys = [...(group.masterKey ? [group.masterKey] : []), ...group.leaves.map((l) => l.key)]
        const isCollapsed = collapsed.has(group.id)
        const allChecked = groupKeys.length > 0 && groupKeys.every((k) => selectedSet.has(k))

        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => toggleGroupCollapse(group.id)}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform text-muted-foreground", isCollapsed && "-rotate-90")} />
                {group.title}
              </button>
              <button
                type="button"
                onClick={() => selectAllInGroup(groupKeys)}
                className="text-xs text-primary hover:underline"
              >
                {allChecked ? "Clear all" : "Select all"}
              </button>
            </div>

            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-2 pl-1">
                {group.masterKey && (
                  <Chip
                    checked={selectedSet.has(group.masterKey)}
                    label={`All ${group.title} pages`}
                    onClick={() => toggle(group.masterKey!)}
                  />
                )}
                {group.leaves.map((leaf) => (
                  <Chip
                    key={leaf.key}
                    checked={selectedSet.has(leaf.key)}
                    label={leaf.label}
                    onClick={() => toggle(leaf.key)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Other</p>
        <div className="grid grid-cols-2 gap-2 pl-1">
          {LEGACY_ONLY_FLAGS.map((flag) => (
            <Chip
              key={flag.key}
              checked={selectedSet.has(flag.key)}
              label={flag.label}
              onClick={() => toggle(flag.key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

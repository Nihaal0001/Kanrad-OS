"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { navigation, type NavGroup, type NavItem } from "@/lib/constants"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allowedPermissions?: string[]
}

function MobileNavItem({
  item,
  pathname,
  onClose,
}: {
  item: NavItem
  pathname: string
  onClose: () => void
}) {
  const isActive = pathname === item.href
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "border-l-[3px] border-sidebar-accent-foreground bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-l-[3px] border-transparent text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.title}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent-foreground px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function MobileNavGroup({
  group,
  pathname,
  onClose,
}: {
  group: NavGroup
  pathname: string
  onClose: () => void
}) {
  return (
    <div className="py-1">
      {group.label && (
        <p className="mb-1 px-3 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {group.label}
        </p>
      )}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <MobileNavItem
            key={item.href}
            item={item}
            pathname={pathname}
            onClose={onClose}
          />
        ))}
      </div>
    </div>
  )
}

export function MobileNav({ open, onOpenChange, allowedPermissions }: MobileNavProps) {
  const pathname = usePathname()

  const allowed = new Set(allowedPermissions ?? [])
  const filteredNavigation: NavGroup[] = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || allowed.has(item.permission)
      ),
    }))
    .filter((group) => group.items.length > 0)

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-6 py-4">
          <SheetTitle className="font-serif text-xl font-bold tracking-tight text-sidebar-foreground">
            JUST CLOTHING
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <nav className="flex flex-col gap-0.5 px-3 py-2">
            {filteredNavigation.map((group, index) => (
              <MobileNavGroup
                key={group.label || `group-${index}`}
                group={group}
                pathname={pathname}
                onClose={handleClose}
              />
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

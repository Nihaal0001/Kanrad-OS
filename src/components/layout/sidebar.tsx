"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import { navigation, type NavGroup, type NavItem } from "@/lib/constants"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SidebarProps {
  className?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

function NavItemLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const isActive = pathname === item.href
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-medium transition-colors",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
        isActive
          ? "border-l-[3px] border-sidebar-accent-foreground bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-l-[3px] border-transparent text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.title}</span>}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent-foreground px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function NavGroupSection({
  group,
  pathname,
  collapsed,
}: {
  group: NavGroup
  pathname: string
  collapsed: boolean
}) {
  return (
    <div className="py-1">
      {group.label && !collapsed && (
        <p className="mb-1 px-3 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {group.label}
        </p>
      )}
      {group.label && collapsed && (
        <div className="mx-auto my-2 h-px w-6 bg-sidebar-border" />
      )}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavItemLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  )
}

export function Sidebar({
  className,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
          collapsed ? "w-[68px]" : "w-[260px]",
          className
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            {collapsed ? (
              <span className="font-serif text-lg font-bold text-sidebar-foreground">
                JC
              </span>
            ) : (
              <h1 className="font-serif text-xl font-bold tracking-tight text-sidebar-foreground">
                JUST CLOTHING
              </h1>
            )}
          </Link>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className={cn(
                "h-7 w-7 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground",
                collapsed && "mx-auto mt-1"
              )}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className={cn("flex-1", collapsed ? "px-2" : "px-3")}>
          <nav className="flex flex-col gap-0.5 pb-4">
            {navigation.map((group, index) => (
              <NavGroupSection
                key={group.label || `group-${index}`}
                group={group}
                pathname={pathname}
                collapsed={collapsed}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-4 py-3">
          {!collapsed && (
            <p className="text-[11px] text-sidebar-foreground/40">v1.0.0</p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

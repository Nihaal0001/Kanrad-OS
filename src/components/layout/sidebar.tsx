"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getActiveNavItem,
  isNavSectionActive,
  navigation,
  type NavSection,
} from "@/lib/constants"
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
  allowedPermissions?: string[]
}

function getActiveSectionIds(pathname: string, sections: NavSection[]) {
  return sections
    .filter((section) => isNavSectionActive(pathname, section))
    .map((section) => section.id)
}

function NavChildLink({
  item,
  isActive,
}: {
  item: NavSection["items"][number]
  isActive: boolean
}) {
  return (
    <Link
      href={item.href}
      prefetch={true}
      className={cn(
        "group flex items-center rounded-xl px-4 py-2.5 text-sm transition-all duration-200",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/90 hover:bg-sidebar-accent/35 hover:text-sidebar-foreground"
      )}
    >
      <span className="truncate">{item.title}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent-foreground px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function CollapsedSectionButton({
  section,
  pathname,
  onOpenSection,
}: {
  section: NavSection
  pathname: string
  onOpenSection: () => void
}) {
  const Icon = section.icon
  const isActive = isNavSectionActive(pathname, section)

  const button = (
    <button
      type="button"
      onClick={onOpenSection}
      className={cn(
        "flex w-full items-center justify-center rounded-xl border border-transparent px-2 py-2.5 text-sm transition-all duration-200",
        isActive
          ? "border-sidebar-accent/20 bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:border-sidebar-border hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
      )}
      aria-label={section.title}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {section.title}
      </TooltipContent>
    </Tooltip>
  )
}

function ExpandedSection({
  section,
  pathname,
  isOpen,
  onToggle,
}: {
  section: NavSection
  pathname: string
  isOpen: boolean
  onToggle: () => void
}) {
  const Icon = section.icon
  const isActive = isNavSectionActive(pathname, section)
  const activeItem = getActiveNavItem(pathname, section.items)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-transparent bg-transparent transition-all duration-300",
        isOpen
          ? "border-sidebar-border/80 bg-sidebar-foreground/[0.02] shadow-sm"
          : "hover:border-sidebar-border/60 hover:bg-sidebar-foreground/[0.015]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-300",
          isActive
            ? "text-sidebar-accent-foreground"
            : "text-sidebar-foreground/90 hover:text-sidebar-foreground"
        )}
        aria-expanded={isOpen}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
            isOpen || isActive
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-foreground/60"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
        </div>
        <span className="flex-1 truncate">{section.title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-300 ease-out",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {isOpen && (
        <div className="overflow-hidden">
          <div className="space-y-1 px-4 pb-4 pt-1 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {section.items.map((item) => (
              <NavChildLink
                key={item.href}
                item={item}
                isActive={activeItem?.href === item.href}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  className,
  collapsed = false,
  onToggleCollapse,
  allowedPermissions,
}: SidebarProps) {
  const pathname = usePathname()

  const allowed = new Set(allowedPermissions ?? [])
  const filteredNavigation: NavSection[] = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || allowed.has(item.permission)
      ),
    }))
    .filter((section) => section.items.length > 0)

  const activeSectionIds = getActiveSectionIds(pathname, filteredNavigation)
  const defaultOpenSectionId = activeSectionIds[0] ?? null
  const [navState, setNavState] = useState<{
    pathname: string
    openSectionId: string | null
  }>(() => ({
    pathname,
    openSectionId: defaultOpenSectionId,
  }))

  function isSectionOpen(sectionId: string) {
    const openSectionId =
      navState.pathname === pathname ? navState.openSectionId : defaultOpenSectionId

    return openSectionId === sectionId
  }

  function toggleSection(sectionId: string) {
    setNavState({
      pathname,
      openSectionId: isSectionOpen(sectionId) ? null : sectionId,
    })
  }

  function handleCollapsedSectionOpen(sectionId: string) {
    setNavState({
      pathname,
      openSectionId: sectionId,
    })
    onToggleCollapse?.()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
          collapsed ? "w-[68px]" : "w-[260px]",
          className
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 overflow-hidden">
            {collapsed ? (
              <span className="font-serif text-lg font-bold text-white">K</span>
            ) : (
              <span className="font-serif text-xl font-bold tracking-widest text-white">KANRAD</span>
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

        <ScrollArea className={cn("flex-1", collapsed ? "px-2" : "px-3")}>
          <nav className="flex flex-col gap-1 pb-4">
            {filteredNavigation.map((section) =>
              collapsed ? (
                <CollapsedSectionButton
                  key={section.id}
                  section={section}
                  pathname={pathname}
                  onOpenSection={() => handleCollapsedSectionOpen(section.id)}
                />
              ) : (
                <ExpandedSection
                  key={section.id}
                  section={section}
                  pathname={pathname}
                  isOpen={isSectionOpen(section.id)}
                  onToggle={() => toggleSection(section.id)}
                />
              )
            )}
          </nav>
        </ScrollArea>

        <div className="border-t border-sidebar-border px-4 py-3">
          {!collapsed && (
            <p className="text-[11px] text-sidebar-foreground/40">v1.0.0</p>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}

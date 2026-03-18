"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  getActiveNavItem,
  isNavSectionActive,
  navigation,
  type NavSection,
} from "@/lib/constants"
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

function getActiveSectionIds(pathname: string, sections: NavSection[]) {
  return sections
    .filter((section) => isNavSectionActive(pathname, section))
    .map((section) => section.id)
}

function MobileNavItem({
  item,
  isActive,
  onClose,
}: {
  item: NavSection["items"][number]
  isActive: boolean
  onClose: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40 transition-all duration-200",
          isActive && "opacity-100"
        )}
      />
      <span className="truncate">{item.title}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent-foreground px-1.5 text-[10px] font-semibold text-white">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function MobileNavSection({
  section,
  pathname,
  isOpen,
  onToggle,
  onClose,
}: {
  section: NavSection
  pathname: string
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
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
            : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
        )}
        aria-expanded={isOpen}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
            isOpen || isActive
              ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
              : "bg-sidebar-foreground/[0.05] text-sidebar-foreground/60"
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
          <div className="space-y-0.5 px-3 pb-3 pl-14 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            {section.items.map((item) => (
              <MobileNavItem
                key={item.href}
                item={item}
                isActive={activeItem?.href === item.href}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function MobileNav({ open, onOpenChange, allowedPermissions }: MobileNavProps) {
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

  function handleClose() {
    onOpenChange(false)
  }

  function toggleSection(sectionId: string) {
    setNavState({
      pathname,
      openSectionId: isSectionOpen(sectionId) ? null : sectionId,
    })
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
          <nav className="flex flex-col gap-1 px-3 py-2">
            {filteredNavigation.map((section) => (
              <MobileNavSection
                key={section.id}
                section={section}
                pathname={pathname}
                isOpen={isSectionOpen(section.id)}
                onToggle={() => toggleSection(section.id)}
                onClose={handleClose}
              />
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

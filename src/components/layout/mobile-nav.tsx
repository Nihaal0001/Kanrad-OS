"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

import { cn } from "@/lib/utils"
import { getFilteredFlatNavItems, isNavItemActive } from "@/lib/constants"
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

export function MobileNav({ open, onOpenChange, allowedPermissions }: MobileNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const items = getFilteredFlatNavItems(allowedPermissions)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    onOpenChange(false)
  }

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-6 py-4">
          <SheetTitle className="font-serif text-xl font-bold tracking-tight text-sidebar-foreground">
            KANRAD ERP
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="grid grid-cols-2 gap-2 p-3 pb-6">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = isNavItemActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleClose}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "border-sidebar-accent/60 bg-sidebar-accent/20 text-sidebar-accent-foreground"
                      : "border-sidebar-border/50 bg-sidebar-foreground/[0.03] text-sidebar-foreground/80 hover:border-sidebar-accent/30 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground"
                  )}
                >
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    isActive
                      ? "bg-sidebar-accent/30 text-sidebar-accent-foreground"
                      : "bg-sidebar-foreground/[0.06] text-sidebar-foreground/60"
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent-foreground px-1 text-[10px] font-semibold text-white">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 rounded-2xl border border-sidebar-border/50 bg-sidebar-foreground/[0.03] px-3 py-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sidebar-foreground/[0.06] text-sidebar-foreground/60">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="truncate">Logout</span>
            </button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

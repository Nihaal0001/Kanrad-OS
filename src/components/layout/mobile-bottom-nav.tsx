"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { getActiveMobileTab, mobilePrimaryTabs } from "@/lib/constants"

export function MobileBottomNav() {
  const pathname = usePathname()
  const activeTab = getActiveMobileTab(pathname)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 flex justify-center pr-[5.5rem] pl-4 lg:hidden">
      <nav
        aria-label="Primary mobile navigation"
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-border/70 bg-[rgba(250,247,242,0.84)] px-2 py-2 shadow-[0_18px_40px_rgba(44,32,24,0.18),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(34,27,23,0.78)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        {mobilePrimaryTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/16 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:bg-primary/18 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-foreground/70 hover:bg-black/5 hover:text-foreground dark:text-sidebar-foreground/78 dark:hover:bg-white/5 dark:hover:text-sidebar-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "text-current")} />
              <span className="truncate leading-none">{tab.title}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

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
        className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-1 rounded-full border border-border bg-card px-2 py-2 shadow-lg"
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
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
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

"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CommandPalette } from "@/components/command-palette"
import { AIChatWidget } from "@/components/shared/ai-chat-widget"
import { cn } from "@/lib/utils"

interface UserProfile {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

interface DashboardShellProps {
  children: React.ReactNode
  unreadCount: number
  userProfile: UserProfile
  allowedPermissions: string[]
}

export function DashboardShell({ children, unreadCount, userProfile, allowedPermissions }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden lg:flex"
        allowedPermissions={allowedPermissions}
      />
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        allowedPermissions={allowedPermissions}
      />
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[margin] duration-300",
          sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
        )}
      >
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          onSearchClick={() => setPaletteOpen(true)}
          unreadCount={unreadCount}
          userProfile={userProfile}
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AIChatWidget />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { KeepAlive } from "@/components/shared/keep-alive"
import { cn } from "@/lib/utils"

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false }
)

const AIChatWidget = dynamic(
  () => import("@/components/shared/ai-chat-widget").then((module) => module.AIChatWidget),
  { ssr: false }
)

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
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [extrasReady, setExtrasReady] = useState(false)

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

  // Keep voice/AI code off the critical hydration path. It becomes available
  // as soon as the browser has finished the initial page work.
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setExtrasReady(true), { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }

    const id = globalThis.setTimeout(() => setExtrasReady(true), 500)
    return () => globalThis.clearTimeout(id)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden lg:flex"
        allowedPermissions={allowedPermissions}
      />
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-[margin] duration-300",
          sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[260px]"
        )}
      >
        <Topbar
          onMenuClick={() => undefined}
          onSearchClick={() => setPaletteOpen(true)}
          unreadCount={unreadCount}
          userProfile={userProfile}
        />
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] sm:px-5 sm:py-6 sm:pb-28 lg:p-8">
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
      {paletteOpen && <CommandPalette open onOpenChange={setPaletteOpen} />}
      {extrasReady && <AIChatWidget />}
      <KeepAlive />
    </div>
  )
}

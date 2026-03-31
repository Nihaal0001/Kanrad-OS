"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function MobileLogout() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 text-sm font-medium text-foreground transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent/10 text-sidebar-accent-foreground">
        <LogOut className="h-4 w-4" />
      </span>
      <span className="truncate">Logout</span>
    </button>
  )
}

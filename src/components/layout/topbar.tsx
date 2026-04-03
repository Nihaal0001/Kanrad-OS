"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Bell, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  production_manager: "Production Manager",
  inventory_manager: "Inventory Manager",
  qc_head: "QC Head",
  floor_supervisor: "Floor Supervisor",
  worker: "Worker",
}

interface UserProfile {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
}

interface TopbarProps {
  onMenuClick: () => void
  onSearchClick?: () => void
  unreadCount?: number
  userProfile: UserProfile
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function UserMenu({
  userProfile,
  nextThemeLabel,
  setTheme,
  startTransition,
  size,
}: {
  userProfile: UserProfile
  nextThemeLabel: string
  setTheme: (theme: string) => void
  startTransition: (fn: () => void) => void
  size: "sm" | "lg"
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={size === "sm"
            ? "relative ml-1 h-8 w-8 rounded-full"
            : "h-10 w-10 shrink-0 rounded-full border border-border/70 bg-background/70 p-0"
          }
          aria-label="User menu"
        >
          <Avatar className={size === "sm" ? "h-8 w-8" : "h-9 w-9"}>
            <AvatarImage src={userProfile.avatar_url ?? ""} alt={userProfile.full_name} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
              {getInitials(userProfile.full_name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={size === "sm" ? "end" : "start"} className="w-52">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-foreground">{userProfile.full_name}</p>
          <p className="text-xs text-muted-foreground">{ROLE_LABELS[userProfile.role] ?? userProfile.role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => setTheme(nextThemeLabel === "Dark Mode" ? "dark" : "light")}
        >
          {nextThemeLabel}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onSelect={async () => {
            await fetch("/api/auth/logout", { method: "POST" })
            window.location.href = "/auth/login"
          }}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Topbar({ onMenuClick, onSearchClick, unreadCount = 0, userProfile }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const [, startTransition] = useTransition()
  const nextThemeLabel = theme === "dark" ? "Light Mode" : "Dark Mode"
  void onMenuClick

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3 lg:px-6 lg:py-0">
      <div className="hidden h-16 items-center justify-between lg:flex">
        <Button
          variant="outline"
          className="h-9 w-64 items-center justify-between gap-2 rounded-lg px-3 text-sm text-muted-foreground"
          onClick={onSearchClick}
        >
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
          </div>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            ⌘K
          </kbd>
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle dark mode"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
            asChild
          >
            <Link href="/notifications">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <UserMenu userProfile={userProfile} nextThemeLabel={nextThemeLabel} setTheme={setTheme} startTransition={startTransition} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-3 lg:hidden">
        <UserMenu userProfile={userProfile} nextThemeLabel={nextThemeLabel} setTheme={setTheme} startTransition={startTransition} size="lg" />

        <Button
          variant="outline"
          className="h-10 flex-1 items-center justify-center gap-2 rounded-full border-border/70 bg-background/70 px-4 text-sm text-muted-foreground backdrop-blur-sm"
          onClick={onSearchClick}
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 shrink-0 rounded-full border border-border/70 bg-background/70 backdrop-blur-sm"
          aria-label="Notifications"
          asChild
        >
          <Link href="/notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>
      </div>
    </header>
  )
}

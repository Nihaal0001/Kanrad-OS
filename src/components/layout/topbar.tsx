"use client"

import Link from "next/link"
import { useTransition } from "react"
import { Bell, Menu, Moon, Search, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { logout } from "@/actions/auth"
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

export function Topbar({ onMenuClick, onSearchClick, unreadCount = 0, userProfile }: TopbarProps) {
  const { theme, setTheme } = useTheme()
  const [, startTransition] = useTransition()

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* Search trigger */}
        <Button
          variant="outline"
          className="hidden h-9 w-64 items-center justify-between gap-2 rounded-lg px-3 text-sm text-muted-foreground lg:flex"
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
      </div>

      <div className="flex items-center gap-1">
        {/* Mobile search button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onSearchClick}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle dark mode"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
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

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative ml-1 h-8 w-8 rounded-full"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={userProfile.avatar_url ?? ""} alt={userProfile.full_name} />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                  {getInitials(userProfile.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
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
              className="text-destructive focus:text-destructive cursor-pointer"
              onSelect={() => startTransition(() => { logout() })}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

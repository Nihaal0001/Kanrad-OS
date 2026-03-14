"use client"

import Link from "next/link"
import { Bell, Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface TopbarProps {
  onMenuClick: () => void
  unreadCount?: number
}

export function Topbar({ onMenuClick, unreadCount = 0 }: TopbarProps) {
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
      </div>

      <div className="flex items-center gap-1">
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
                <AvatarImage src="" alt="User avatar" />
                <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                  JC
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem>My Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

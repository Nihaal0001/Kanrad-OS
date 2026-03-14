"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck } from "lucide-react"

import type { Notification } from "@/lib/supabase/types"
import { cn, formatDateRelative } from "@/lib/utils"
import { markAsRead, markAllAsRead } from "@/actions/notifications"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const TYPE_COLORS: Record<string, string> = {
  order_confirmed: "bg-emerald-500",
  stage_complete: "bg-blue-500",
  qc_failure: "bg-red-500",
  low_stock: "bg-amber-500",
  task_assigned: "bg-purple-500",
  deadline: "bg-orange-500",
}

const TYPE_LABELS: Record<string, string> = {
  order_confirmed: "Order",
  stage_complete: "Production",
  qc_failure: "Quality",
  low_stock: "Inventory",
  task_assigned: "Task",
  deadline: "Deadline",
}

interface NotificationsListProps {
  notifications: Notification[]
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  const router = useRouter()
  const [markingAll, setMarkingAll] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(
    new Set(notifications.filter((n) => n.is_read).map((n) => n.id))
  )

  const handleMarkRead = useCallback(
    async (id: string) => {
      setReadIds((prev) => new Set([...prev, id]))
      await markAsRead(id)
      router.refresh()
    },
    [router]
  )

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true)
    setReadIds(new Set(notifications.map((n) => n.id)))
    await markAllAsRead()
    setMarkingAll(false)
    router.refresh()
  }, [notifications, router])

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => {
          const isRead = readIds.has(notification.id)
          const dotColor =
            TYPE_COLORS[notification.type] ?? "bg-muted-foreground"
          const typeLabel =
            TYPE_LABELS[notification.type] ?? notification.type

          return (
            <Card
              key={notification.id}
              className={cn(
                "transition-colors cursor-pointer",
                !isRead && "border-primary/30 bg-primary/5"
              )}
              onClick={() => !isRead && handleMarkRead(notification.id)}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <div
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    isRead ? "bg-muted-foreground/30" : dotColor
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {typeLabel}
                    </span>
                    {!isRead && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="text-sm font-medium">{notification.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateRelative(notification.created_at)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

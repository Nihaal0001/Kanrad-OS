import {
  ShoppingBag,
  CalendarClock,
  AlertTriangle,
  Factory,
  ArrowRight,
  Plus,
  ClipboardCheck,
  Package,
  FileText,
} from "lucide-react"
import Link from "next/link"

import { getDashboardStats } from "@/actions/notifications"
import { createClient } from "@/lib/supabase/server"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AIInsightsPanel } from "@/components/shared/ai-insights-panel"
import { formatDate, formatDateRelative } from "@/lib/utils"
import { cn } from "@/lib/utils"

const QUICK_ACTIONS = [
  { label: "New Order", href: "/orders/new", icon: Plus },
  { label: "Mark Attendance", href: "/hr/attendance", icon: ClipboardCheck },
  { label: "New Purchase Order", href: "/inventory/purchase-orders/new", icon: Package },
  { label: "New Invoice", href: "/finance/invoices/new", icon: FileText },
]

const NOTIFICATION_DOT: Record<string, string> = {
  order_confirmed: "bg-emerald-500",
  stage_complete: "bg-blue-500",
  qc_failure: "bg-red-500",
  low_stock: "bg-amber-500",
  task_assigned: "bg-purple-500",
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("auth_id", user.id).maybeSingle()
    : { data: null }

  const firstName = profile?.full_name?.split(" ")[0] ?? "there"
  const stats = await getDashboardStats()

  return (
    <div className="space-y-8">
      {/* Greeting header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{getGreeting()}, {firstName}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">Here&apos;s what&apos;s happening at JUST CLOTHING today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Orders"
          value={stats.activeOrdersCount}
          description={`${stats.confirmedCount} confirmed, ${stats.inProductionCount} in production`}
          icon={ShoppingBag}
          href="/orders?status=confirmed"
        />
        <StatCard
          title="Due This Week"
          value={stats.dueThisWeekCount}
          description="Orders with deadline in next 7 days"
          icon={CalendarClock}
          href="/orders"
        />
        <StatCard
          title="In Production"
          value={stats.inProductionCount}
          description="Orders actively being manufactured"
          icon={Factory}
          href="/production"
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockCount}
          description="Materials below minimum stock level"
          icon={AlertTriangle}
          href="/inventory?filter=low_stock"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto min-h-14 justify-start gap-3 px-4 py-3 text-left"
              asChild
            >
              <Link href={action.href}>
                <div className="shrink-0 rounded-md bg-accent p-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm leading-tight">{action.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>

      {/* AI Insights */}
      <AIInsightsPanel />

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Orders */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No orders yet.{" "}
                <Link href="/orders/new" className="text-primary underline-offset-4 hover:underline">
                  Create your first order
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex flex-col gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm">{order.order_number}</p>
                        <PriorityIndicator priority={order.priority} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.style_name}
                        {order.customer && ` — ${order.customer.name}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.total_quantity.toLocaleString("en-IN")} pcs · Due{" "}
                        {formatDate(order.deadline)}
                      </p>
                    </div>
                    <div className="self-start sm:self-auto">
                      <StatusBadge status={order.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity (Notifications) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/notifications">
                All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentNotifications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No activity yet.
              </p>
            ) : (
              <div className="space-y-4">
                {stats.recentNotifications.map((n) => (
                  <div key={n.id} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        NOTIFICATION_DOT[n.type] ?? "bg-primary/60"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{n.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateRelative(n.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

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
  Activity,
  TrendingUp,
  Boxes,
  IndianRupee,
  Link2,
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
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">Here&apos;s what&apos;s happening at KANRAD ERP today.</p>
      </div>

      {/* Factory Health Score */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Factory Health Score</h3>
          </div>

          {(() => {
            // Weighted composite: Orders 30%, Production 30%, Inventory 25%, Cash 15%
            const totalOrders = stats.activeOrdersCount + (stats.recentOrders?.length ?? 0)
            const orderHealth = totalOrders > 0
              ? Math.min(100, Math.round(((totalOrders - stats.dueThisWeekCount) / Math.max(totalOrders, 1)) * 100))
              : 0
            const productionHealth = stats.inProductionCount > 0 ? 75 : (stats.activeOrdersCount > 0 ? 25 : 0)
            const inventoryHealth = stats.lowStockCount === 0 ? 100 : Math.max(0, 100 - (stats.lowStockCount * 10))
            const cashHealth = 80 // Placeholder until finance data is integrated

            const composite = Math.round(
              orderHealth * 0.3 + productionHealth * 0.3 + inventoryHealth * 0.25 + cashHealth * 0.15
            )

            const healthColor = composite >= 75 ? "text-emerald-600" : composite >= 50 ? "text-amber-600" : "text-red-600"
            const healthBg = composite >= 75 ? "bg-emerald-500" : composite >= 50 ? "bg-amber-500" : "bg-red-500"

            return (
              <>
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-center">
                    <div className={cn("text-4xl font-bold", healthColor)}>{composite}%</div>
                    <p className="text-xs text-muted-foreground mt-1">Overall Score</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", healthBg)} style={{ width: `${composite}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <ShoppingBag className="h-3.5 w-3.5" /> Orders
                        </span>
                        <span className="font-medium">{orderHealth}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Factory className="h-3.5 w-3.5" /> Production
                        </span>
                        <span className="font-medium">{productionHealth}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Boxes className="h-3.5 w-3.5" /> Inventory
                        </span>
                        <span className="font-medium">{inventoryHealth}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <IndianRupee className="h-3.5 w-3.5" /> Cash
                        </span>
                        <span className="font-medium">{cashHealth}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                    <Link2 className="h-3.5 w-3.5" /> How Metrics Are Linked
                  </div>
                  <ul className="space-y-0.5 ml-5">
                    <li>Low Inventory impacts Production capability</li>
                    <li>Production delays affect Order fulfillment</li>
                    <li>Overdue Orders pull down Order Health</li>
                  </ul>
                </div>

                <div className="mt-3 flex gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded bg-muted px-2 py-0.5">Orders 30%</span>
                  <span className="rounded bg-muted px-2 py-0.5">Production 30%</span>
                  <span className="rounded bg-muted px-2 py-0.5">Inventory 25%</span>
                  <span className="rounded bg-muted px-2 py-0.5">Cash 15%</span>
                </div>
              </>
            )
          })()}
        </CardContent>
      </Card>

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
                        {order.product_variant}
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

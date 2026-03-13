import {
  ShoppingBag,
  CalendarClock,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate, formatDateRelative } from "@/lib/utils"

const stats = [
  {
    title: "Active Orders",
    value: 24,
    description: "8 confirmed, 16 in production",
    icon: ShoppingBag,
    trend: { value: 12, positive: true },
  },
  {
    title: "Due This Week",
    value: 6,
    description: "3 orders need attention",
    icon: CalendarClock,
    trend: { value: 2, positive: false },
  },
  {
    title: "Production Rate",
    value: "94%",
    description: "On-time completion rate",
    icon: TrendingUp,
    trend: { value: 3, positive: true },
  },
  {
    title: "Low Stock Items",
    value: 5,
    description: "2 critical, 3 warning",
    icon: AlertTriangle,
    trend: { value: 1, positive: false },
  },
]

const recentOrders = [
  {
    id: "1",
    orderNumber: "JC-ORD-240313-001",
    buyer: "Urban Threads Co.",
    style: "Classic Polo T-Shirt",
    quantity: 2500,
    deadline: "2026-03-20",
    status: "in_production",
    priority: "high",
  },
  {
    id: "2",
    orderNumber: "JC-ORD-240312-004",
    buyer: "Street Style Ltd.",
    style: "Relaxed Fit Denim",
    quantity: 1800,
    deadline: "2026-03-25",
    status: "confirmed",
    priority: "normal",
  },
  {
    id: "3",
    orderNumber: "JC-ORD-240311-002",
    buyer: "Fresh Basics Inc.",
    style: "Oversized Hoodie",
    quantity: 3000,
    deadline: "2026-03-18",
    status: "in_production",
    priority: "urgent",
  },
  {
    id: "4",
    orderNumber: "JC-ORD-240310-001",
    buyer: "Weekend Wear",
    style: "Cotton Joggers",
    quantity: 1200,
    deadline: "2026-03-28",
    status: "completed",
    priority: "normal",
  },
  {
    id: "5",
    orderNumber: "JC-ORD-240309-003",
    buyer: "Urban Threads Co.",
    style: "Graphic Tee Collection",
    quantity: 4000,
    deadline: "2026-03-15",
    status: "dispatched",
    priority: "low",
  },
]

const productionOverview = [
  { stage: "Fabric Sourcing", orders: 3, progress: 100 },
  { stage: "Cutting", orders: 4, progress: 75 },
  { stage: "Stitching", orders: 6, progress: 45 },
  { stage: "Quality Check", orders: 2, progress: 60 },
  { stage: "Finishing", orders: 3, progress: 80 },
  { stage: "Packing", orders: 2, progress: 90 },
  { stage: "Dispatch", orders: 1, progress: 50 },
]

const recentActivity = [
  {
    message: "Order JC-ORD-240313-001 moved to Stitching stage",
    time: new Date(Date.now() - 15 * 60000).toISOString(),
    type: "production",
  },
  {
    message: "QC check failed for Order JC-ORD-240311-002 — 12 defects found",
    time: new Date(Date.now() - 45 * 60000).toISOString(),
    type: "quality",
  },
  {
    message: "Low stock alert: Cotton Jersey Fabric (23m remaining)",
    time: new Date(Date.now() - 2 * 3600000).toISOString(),
    type: "inventory",
  },
  {
    message: "Invoice INV-2024-089 marked as paid by Urban Threads Co.",
    time: new Date(Date.now() - 4 * 3600000).toISOString(),
    type: "finance",
  },
  {
    message: "New order received from Fresh Basics Inc. — 3000 hoodies",
    time: new Date(Date.now() - 6 * 3600000).toISOString(),
    type: "order",
  },
  {
    message: "Worker shift change: Evening shift started with 18 workers",
    time: new Date(Date.now() - 8 * 3600000).toISOString(),
    type: "hr",
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your manufacturing operations"
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Orders - Left Column */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/orders">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{order.orderNumber}</p>
                      <PriorityIndicator priority={order.priority} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {order.style} — {order.buyer}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.quantity.toLocaleString()} pcs · Due{" "}
                      {formatDate(order.deadline)}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Production Overview - Right Column */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Production Pipeline</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/production">
                Details <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {productionOverview.map((stage) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="text-muted-foreground">
                      {stage.orders} orders
                    </span>
                  </div>
                  <Progress value={stage.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateRelative(activity.time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

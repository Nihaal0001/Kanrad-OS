import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"

import { getOrderProduction, getDailyLogs } from "@/actions/production"
import { formatDate, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { LogProductionDialog } from "@/components/production/log-production-dialog"

interface ProductionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ProductionDetailPage({
  params,
}: ProductionDetailPageProps) {
  const { id } = await params

  let order
  let dailyLogs: Awaited<ReturnType<typeof getDailyLogs>> = []
  try {
    order = await getOrderProduction(id)
    dailyLogs = await getDailyLogs(id)
  } catch {
    notFound()
  }

  // Production output is tracked purely from the daily piece logs.
  const totalProduced = dailyLogs.reduce((s, l) => s + (l.quantity_produced ?? 0), 0)
  const totalRejected = dailyLogs.reduce((s, l) => s + (l.quantity_rejected ?? 0), 0)
  const remaining = Math.max(0, order.total_quantity - totalProduced)
  const progressPct = order.total_quantity > 0
    ? Math.min(100, Math.round((totalProduced / order.total_quantity) * 100))
    : 0

  return (
    <>
      <PageHeader
        title={order.order_number}
        description={`${order.product_variant} · ${order.total_quantity.toLocaleString("en-IN")} pcs`}
        breadcrumbs={[
          { label: "Production", href: "/production" },
          { label: order.order_number },
        ]}
      >
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/production">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <LogProductionDialog
          orders={[{ id, order_number: order.order_number, product_variant: order.product_variant, total_quantity: order.total_quantity, customer: order.customer ?? null }]}
          preselectedOrderId={id}
          preselectedTotalQty={order.total_quantity}
        />
        <Button asChild>
          <Link href={`/production/${id}/qc`}>
            <Plus className="h-4 w-4" />
            Add QC Check
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left — output summary + log */}
        <div className="lg:col-span-2 space-y-4">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Order", value: order.total_quantity, color: "" },
              { label: "Produced", value: totalProduced, color: "text-emerald-600" },
              { label: "Remaining", value: remaining, color: "text-amber-600" },
              { label: "Rejected", value: totalRejected, color: "text-red-500" },
            ].map((stat) => (
              <Card key={stat.label} className="text-center py-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>
                  {stat.value.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground">pcs</p>
              </Card>
            ))}
          </div>

          {/* Progress bar */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">Production Output</span>
                <span className="text-muted-foreground">
                  {totalProduced.toLocaleString("en-IN")} / {order.total_quantity.toLocaleString("en-IN")} pcs
                </span>
              </div>
              <Progress value={progressPct} className="h-3 rounded-full" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{progressPct}% complete</span>
                <span>{remaining.toLocaleString("en-IN")} pcs remaining</span>
              </div>
            </CardContent>
          </Card>

          {/* Daily Production Log */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Production Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dailyLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No production logged yet — tap &quot;Log Production&quot; to record output.
                </p>
              ) : (
                <div className="space-y-2">
                  {dailyLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium">{new Date(log.log_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                        {log.notes && <p className="text-xs text-muted-foreground">{log.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">+{log.quantity_produced.toLocaleString("en-IN")} pcs</p>
                        {log.quantity_rejected > 0 && (
                          <p className="text-xs text-red-500">{log.quantity_rejected.toLocaleString("en-IN")} rejected</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customer?.name ?? "—"}
                  {order.customer?.company && <span className="text-muted-foreground"> ({order.customer.company})</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium">{formatDate(order.deadline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity</p>
                <p className="font-medium">{order.total_quantity.toLocaleString("en-IN")} pcs</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1"><StatusBadge status={order.status} /></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

import Link from "next/link"
import {
  Users,
  Clock,
  UserX,
  CalendarDays,
  AlertCircle,
  TrendingUp,
} from "lucide-react"

import { getHROverview } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AddWorkersSheet } from "@/components/hr/add-workers-sheet"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  present: "border border-emerald-500 text-emerald-600",
  absent: "border border-red-500 text-red-600",
  half_day: "border border-amber-500 text-amber-600",
  leave: "border border-blue-500 text-blue-600",
}

const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "On Leave",
}

export default async function HROverviewPage() {
  const data = await getHROverview()

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  // Merge all workers with their today attendance status
  const attMap = new Map(data.todayAtt.map((a: { worker_id: string }) => [a.worker_id, a]))
  const allWorkerRows = data.workers
    .map((w) => ({
      id: w.id,
      name: w.full_name,
      department: w.department,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attendance: (attMap.get(w.id) as any) ?? null,
    }))
    .sort((a, b) => {
      if (a.attendance && !b.attendance) return -1
      if (!a.attendance && b.attendance) return 1
      return (a.name ?? "").localeCompare(b.name ?? "")
    })

  // Top 5 OT earners this month
  const otLeaderboard = data.workers
    .map((w) => ({ id: w.id, name: w.full_name, hours: data.otByWorker[w.id] ?? 0 }))
    .filter((w) => w.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5)

  const statCards = [
    { title: "Total Workers", value: data.totalWorkers, icon: Users, href: "/users" },
    { title: "Present Today", value: data.present, icon: Clock, color: "text-emerald-600" },
    { title: "Absent", value: data.absent, icon: UserX, color: "text-red-600" },
    { title: "On Leave", value: data.onLeave, icon: CalendarDays, color: "text-blue-600" },
    { title: "Not Marked", value: data.unmarked, icon: AlertCircle, color: "text-amber-600" },
  ]

  return (
    <>
      <PageHeader title="HR Overview" description={today}>
        <AddWorkersSheet />
      </PageHeader>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-1 flex items-center gap-2">
                <card.icon className={cn("h-4 w-4 text-muted-foreground", card.color)} />
                <span className="text-xs text-muted-foreground">{card.title}</span>
              </div>
              <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Today's attendance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">
              Today&apos;s Attendance
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {data.present}/{data.totalWorkers} marked present
              </span>
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/hr/attendance">Mark Attendance</Link>
            </Button>
          </CardHeader>
          <CardContent className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {allWorkerRows.map((w) => (
              <div key={w.id} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium">{w.name}</p>
                  {w.department && (
                    <p className="text-xs text-muted-foreground">{w.department}</p>
                  )}
                </div>
                {w.attendance ? (
                  <Badge
                    className={cn(
                      "bg-transparent text-xs font-medium",
                      STATUS_STYLES[w.attendance.status]
                    )}
                  >
                    {STATUS_LABELS[w.attendance.status] ?? w.attendance.status}
                  </Badge>
                ) : (
                  <Badge className="bg-transparent text-xs font-medium border border-muted-foreground text-muted-foreground">
                    Not Marked
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          {/* Pending leaves */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">
                Pending Leaves
                {data.pendingLeaves.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {data.pendingLeaves.length}
                  </span>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/hr/leaves">Review All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.pendingLeaves.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending leave requests</p>
              ) : (
                <div className="space-y-3">
                  {data.pendingLeaves.slice(0, 5).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (l: any) => (
                      <div key={l.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{l.worker?.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.from_date} → {l.to_date}
                            <span className="ml-1 capitalize">· {l.leave_type}</span>
                          </p>
                        </div>
                        <Badge className="bg-transparent text-xs font-medium border border-amber-500 text-amber-600 shrink-0">
                          Pending
                        </Badge>
                      </div>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* OT leaderboard */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Top OT This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {otLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overtime recorded this month</p>
              ) : (
                <div className="space-y-2">
                  {otLeaderboard.map((w, i) => (
                    <div key={w.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-xs text-muted-foreground">{i + 1}.</span>
                        <p className="text-sm font-medium">{w.name}</p>
                      </div>
                      <p className="text-sm font-semibold">{w.hours}h</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

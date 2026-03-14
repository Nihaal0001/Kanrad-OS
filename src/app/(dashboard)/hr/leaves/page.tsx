import { CalendarDays } from "lucide-react"

import { getLeaves, getWorkers, updateLeaveStatus } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { LeaveForm } from "@/components/hr/leave-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
}

const LEAVE_LABELS: Record<string, string> = {
  sick: "Sick",
  casual: "Casual",
  earned: "Earned",
  unpaid: "Unpaid",
  other: "Other",
}

export default async function LeavesPage() {
  const [leaves, workers] = await Promise.all([getLeaves(), getWorkers()])

  return (
    <>
      <PageHeader title="Leaves" description="Leave requests and approvals">
        <LeaveForm workers={workers} />
      </PageHeader>

      {leaves.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave requests"
          description="Leave requests will appear here"
        />
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <Card key={leave.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] gap-4 items-center">
                  <div>
                    <p className="text-sm font-medium">{leave.worker?.full_name ?? "—"}</p>
                    {leave.worker?.department && (
                      <p className="text-xs text-muted-foreground">{leave.worker.department}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="w-fit text-xs">
                    {LEAVE_LABELS[leave.leave_type] ?? leave.leave_type}
                  </Badge>
                  <div>
                    <p className="text-sm">{leave.from_date} → {leave.to_date}</p>
                    <p className="text-xs text-muted-foreground">{leave.days} day{leave.days !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{leave.reason ?? "—"}</p>
                  <Badge className={cn("w-fit text-xs font-medium", STATUS_STYLES[leave.status])}>
                    {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                  </Badge>
                </div>

                {leave.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <form
                      action={async () => {
                        "use server"
                        await updateLeaveStatus(leave.id, "approved")
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline" className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-50">
                        Approve
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server"
                        await updateLeaveStatus(leave.id, "rejected")
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-red-50">
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

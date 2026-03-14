import { Wallet } from "lucide-react"

import { getPayrolls, getWorkers, updatePayrollStatus, deletePayroll } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PayrollForm } from "@/components/hr/payroll-form"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

export default async function PayrollPage() {
  const [payrolls, workers] = await Promise.all([getPayrolls(), getWorkers()])

  const totalWages = payrolls.reduce((sum, p) => sum + p.total_wage, 0)

  return (
    <>
      <PageHeader
        title="Payroll"
        description={
          payrolls.length > 0
            ? `${payrolls.length} records · ₹${formatCurrency(totalWages)} total wages`
            : "Worker wages and payroll management"
        }
      >
        <PayrollForm workers={workers} />
      </PageHeader>

      {payrolls.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payroll records"
          description="Generate payroll from attendance data"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_100px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Worker</span>
            <span>Period</span>
            <span>Days</span>
            <span>OT Hrs</span>
            <span>Deductions</span>
            <span>Total</span>
            <span>Status</span>
          </div>

          {payrolls.map((p) => (
            <Card key={p.id}>
              <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_100px] items-center gap-4 p-4">
                <div>
                  <p className="text-sm font-medium">{p.worker?.full_name ?? "—"}</p>
                  {p.worker?.department && (
                    <p className="text-xs text-muted-foreground">{p.worker.department}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{p.period_start}</p>
                  <p className="text-xs text-muted-foreground">{p.period_end}</p>
                </div>
                <p className="text-sm text-muted-foreground">{p.days_present}/{p.working_days}</p>
                <p className="text-sm text-muted-foreground">{p.overtime_hours}h</p>
                <p className="text-sm text-muted-foreground">₹{formatCurrency(p.deductions)}</p>
                <p className="text-sm font-semibold">₹{formatCurrency(p.total_wage)}</p>
                <div className="flex items-center gap-1">
                  {p.status === "draft" ? (
                    <form
                      action={async () => {
                        "use server"
                        await updatePayrollStatus(p.id, "paid")
                      }}
                    >
                      <Button type="submit" size="sm" variant="outline" className="text-emerald-600 border-emerald-600/30 text-xs h-7 px-2">
                        Mark Paid
                      </Button>
                    </form>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs font-medium">Paid</Badge>
                  )}
                  {p.status === "draft" && (
                    <form
                      action={async () => {
                        "use server"
                        await deletePayroll(p.id)
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

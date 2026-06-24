import { FileDown, Wallet } from "lucide-react"

import { getPayrolls, getWorkers, updatePayrollStatus, deletePayroll } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PayrollForm } from "@/components/hr/payroll-form"
import { WorkerSalariesSheet } from "@/components/hr/worker-salaries-sheet"
import { GeneratePayrollButton } from "@/components/hr/generate-payroll-button"
import { HRDateFilter } from "@/components/hr/date-filter"
import { DeleteButton } from "@/components/hr/delete-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function PayrollPage({ searchParams }: Props) {
  const { month } = await searchParams
  const [payrolls, workers] = await Promise.all([
    getPayrolls(month ? { month } : undefined),
    getWorkers(),
  ])

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
        <HRDateFilter type="month" value={month ?? ""} />
        <WorkerSalariesSheet workers={workers} />
        <GeneratePayrollButton />
        <PayrollForm workers={workers} />
      </PageHeader>

      {payrolls.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No payroll records"
          description={month ? `No payroll for ${month}` : "Generate payroll from attendance data"}
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_120px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Worker</span>
            <span>Period</span>
            <span>Days</span>
            <span>OT Hrs</span>
            <span>Deductions</span>
            <span>Total</span>
            <span>Actions</span>
          </div>

          {payrolls.map((p) => (
            <Card key={p.id}>
              <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_1fr_120px] items-center gap-4 p-4">
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
                <div className="flex items-center gap-1 flex-wrap">
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
                  <a href={`/api/payslip/${p.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground">
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                  {p.status === "draft" && (
                    <DeleteButton
                      title="Delete Payroll Record"
                      description={`Delete this draft payroll record for ${p.worker?.full_name ?? "this worker"}?`}
                      onDelete={() => deletePayroll(p.id)}
                    />
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

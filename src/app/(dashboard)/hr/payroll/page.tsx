import { FileDown } from "lucide-react"

import { getPayrolls, getWorkers, getPayrollRegister, updatePayrollStatus, deletePayroll } from "@/actions/hr"
import { PageHeader } from "@/components/shared/page-header"
import { PayrollForm } from "@/components/hr/payroll-form"
import { WorkerSalariesSheet } from "@/components/hr/worker-salaries-sheet"
import { GeneratePayrollButton } from "@/components/hr/generate-payroll-button"
import { WorkerPayrollList } from "@/components/hr/worker-payroll-list"
import { HRDateFilter } from "@/components/hr/date-filter"
import { DeleteButton } from "@/components/hr/delete-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function PayrollPage({ searchParams }: Props) {
  const { month } = await searchParams
  const [payrolls, workers, register] = await Promise.all([
    getPayrolls(month ? { month } : undefined),
    getWorkers(),
    getPayrollRegister(month),
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
        <WorkerPayrollList data={register} />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0] shadow-border">
                <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">No.</th>
                  <th className="px-4 py-2.5 text-left">Worker</th>
                  <th className="px-4 py-2.5 text-left">Period</th>
                  <th className="px-4 py-2.5 text-right">Days</th>
                  <th className="px-4 py-2.5 text-right">OT Hrs</th>
                  <th className="px-4 py-2.5 text-right">Deductions</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{p.worker?.roll_no ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium">{p.worker?.full_name ?? "—"}</p>
                      {p.worker?.department && (
                        <p className="text-xs text-muted-foreground">{p.worker.department}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs text-muted-foreground">{p.period_start}</p>
                      <p className="text-xs text-muted-foreground">{p.period_end}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{p.days_present}/{p.working_days}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{p.overtime_hours}h</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">₹{formatCurrency(p.deductions)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">₹{formatCurrency(p.total_wage)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
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
                            onDelete={deletePayroll.bind(null, p.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  )
}

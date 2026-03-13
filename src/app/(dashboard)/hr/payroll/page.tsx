import { Wallet } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function PayrollPage() {
  return (
    <>
      <PageHeader
        title="Payroll"
        description="Worker wages and payroll management"
      />
      <EmptyState
        icon={Wallet}
        title="No payroll records"
        description="Generate payroll from attendance data"
      />
    </>
  )
}

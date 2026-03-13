import { CreditCard } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function PaymentsPage() {
  return (
    <>
      <PageHeader
        title="Payments"
        description="Track payments received and pending"
      />
      <EmptyState
        icon={CreditCard}
        title="No payments recorded"
        description="Payments will appear here as invoices are paid"
      />
    </>
  )
}

import { CalendarClock } from "lucide-react"

import { getUpcomingPayments } from "@/actions/upcoming-payments"
import { todayIST } from "@/lib/payment-terms"
import { PageHeader } from "@/components/shared/page-header"
import { UpcomingPayments } from "@/components/finance/upcoming-payments"
import { EmptyState } from "@/components/shared/empty-state"

export const dynamic = "force-dynamic"

export default async function UpcomingPaymentsPage() {
  const payments = await getUpcomingPayments()

  return (
    <>
      <PageHeader
        title="Payment Calendar"
        description="Money coming in from customers and going out to suppliers, by due date"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Payment Calendar" }]}
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No payments scheduled"
          description="Open customer invoices and supplier bills appear here with their due dates."
        />
      ) : (
        <UpcomingPayments payments={payments} today={todayIST()} />
      )}
    </>
  )
}

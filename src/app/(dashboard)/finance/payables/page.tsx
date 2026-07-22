import { Wallet } from "lucide-react"

import { getPayables } from "@/actions/purchase-invoices"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PayablesList } from "@/components/finance/payables-list"

export default async function PayablesPage() {
  const payables = await getPayables()

  return (
    <>
      <PageHeader
        title="Payables"
        description="Money Kanrad owes suppliers — due 50 days (or the supplier's own terms) after each purchase invoice"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Payables" }]}
      />

      {payables.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nothing owed"
          description="Payables appear here once a purchase invoice is recorded against a received PO."
        />
      ) : (
        <PayablesList payables={payables} />
      )}
    </>
  )
}

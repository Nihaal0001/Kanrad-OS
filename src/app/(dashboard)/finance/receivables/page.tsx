import { Wallet2 } from "lucide-react"

import { getReceivables } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ReceivablesList } from "@/components/finance/receivables-list"

export default async function ReceivablesPage() {
  const receivables = await getReceivables()

  return (
    <>
      <PageHeader
        title="Receivables"
        description="Money customers owe Kanrad — outstanding invoices from dispatched orders"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Receivables" }]}
      />

      {receivables.length === 0 ? (
        <EmptyState
          icon={Wallet2}
          title="Nothing outstanding"
          description="Receivables appear here once an order is dispatched and invoiced."
        />
      ) : (
        <ReceivablesList receivables={receivables} />
      )}
    </>
  )
}

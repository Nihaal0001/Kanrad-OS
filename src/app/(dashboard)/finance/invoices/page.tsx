import { FileText } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Generate and manage invoices"
      />
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Create an invoice from a completed order"
      />
    </>
  )
}

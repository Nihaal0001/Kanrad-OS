import { Calculator } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function CostingPage() {
  return (
    <>
      <PageHeader
        title="Costing"
        description="Per-order cost breakdown and analysis"
      />
      <EmptyState
        icon={Calculator}
        title="No costing data"
        description="Cost breakdowns will appear here as orders are processed"
      />
    </>
  )
}

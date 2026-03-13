import { Factory } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function ProductionPage() {
  return (
    <>
      <PageHeader
        title="Production"
        description="Track orders through the production pipeline"
      />
      <EmptyState
        icon={Factory}
        title="No active production"
        description="Confirm an order to start tracking production"
      />
    </>
  )
}

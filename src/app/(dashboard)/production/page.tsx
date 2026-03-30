import { Factory } from "lucide-react"

import { getProductionOverview, getProductionStages } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PipelineView } from "@/components/production/pipeline-view"

export default async function ProductionPage() {
  const [orders, stages] = await Promise.all([
    getProductionOverview(),
    getProductionStages(),
  ])

  const stageNames = stages.map((s) => s.name)

  return (
    <>
      <PageHeader
        title="Production"
        description="Track production batches and efficiency through the 7-stage cookware manufacturing pipeline"
      />

      {orders.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No active production"
          description="Confirm an order to start tracking it through the production pipeline."
          action={{ label: "View Orders", href: "/orders" }}
        />
      ) : (
        <PipelineView orders={orders} stageNames={stageNames} />
      )}
    </>
  )
}

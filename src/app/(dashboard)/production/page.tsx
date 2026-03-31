import { Factory } from "lucide-react"

import { getProductionOverview, getProductionStages, getOrdersForProduction, getOrdersForBatch } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PipelineView } from "@/components/production/pipeline-view"
import { RecordProductionSheet } from "@/components/production/record-production-sheet"

export default async function ProductionPage() {
  const [orders, stages, activeOrders, batchOrders] = await Promise.all([
    getProductionOverview(),
    getProductionStages(),
    getOrdersForProduction(),
    getOrdersForBatch(),
  ])

  const stageNames = stages.map((s) => s.name)

  return (
    <>
      <PageHeader
        title="Production"
        description="Track production batches and record daily output through the manufacturing pipeline"
      >
        {batchOrders.length > 0 && (
          <RecordProductionSheet orders={batchOrders} />
        )}
      </PageHeader>

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

export const revalidate = 60

import { Factory } from "lucide-react"

import { getProductionOverview, getProductionStages, getOrdersForProduction, getOrdersForBatch } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PipelineView } from "@/components/production/pipeline-view"
import { RecordProductionSheet } from "@/components/production/record-production-sheet"
import { LogProductionDialog } from "@/components/production/log-production-dialog"

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
        {activeOrders.length > 0 && (
          <LogProductionDialog orders={activeOrders} />
        )}
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

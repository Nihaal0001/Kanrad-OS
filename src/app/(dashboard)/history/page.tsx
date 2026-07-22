import {
  getHistoryOrders,
  getHistoryProduction,
  getHistoryPurchaseOrders,
  getHistoryLogistics,
  getHistoryFinance,
  getHistoryPayables,
  getHistoryDispatches,
} from "@/actions/history"
import { PageHeader } from "@/components/shared/page-header"
import { HistoryTabs } from "@/components/history/history-tabs"

export default async function HistoryPage() {
  const [orders, batches, purchaseOrders, shipments, transactions, payables, dispatches] = await Promise.all([
    getHistoryOrders(),
    getHistoryProduction(),
    getHistoryPurchaseOrders(),
    getHistoryLogistics(),
    getHistoryFinance(),
    getHistoryPayables(),
    getHistoryDispatches(),
  ])

  return (
    <>
      <PageHeader
        title="History"
        description="Read-only archive of completed orders, batches, purchase orders, shipments, and finance records"
        breadcrumbs={[{ label: "History" }]}
      />

      <HistoryTabs
        orders={orders}
        batches={batches}
        purchaseOrders={purchaseOrders}
        shipments={shipments}
        transactions={transactions}
        payables={payables}
        dispatches={dispatches}
      />
    </>
  )
}

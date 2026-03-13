import { ShoppingBag } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Manage buyer orders and track their progress"
      />
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        description="Create your first order to get started"
      />
    </>
  )
}

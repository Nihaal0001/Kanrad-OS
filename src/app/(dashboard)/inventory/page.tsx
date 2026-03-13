import { Package } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Track raw materials and stock levels"
      />
      <EmptyState
        icon={Package}
        title="No materials added"
        description="Add your first material to start tracking inventory"
      />
    </>
  )
}

import Link from "next/link"
import { Package, Plus, History } from "lucide-react"

import { getMaterials, getCategories } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { MaterialsTable } from "@/components/inventory/materials-table"

export default async function InventoryPage() {
  const [materials, categories] = await Promise.all([
    getMaterials(),
    getCategories(),
  ])

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Track raw materials and stock levels"
      >
        <Button variant="outline" asChild>
          <Link href="/inventory/history">
            <History className="h-4 w-4" />
            Stock History
          </Link>
        </Button>
        <Button asChild>
          <Link href="/inventory/new">
            <Plus className="h-4 w-4" />
            Add Material
          </Link>
        </Button>
      </PageHeader>

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No materials added"
          description="Add your first material to start tracking inventory and stock levels."
          action={{ label: "Add Material", href: "/inventory/new" }}
        />
      ) : (
        <MaterialsTable materials={materials} categories={categories} />
      )}
    </>
  )
}

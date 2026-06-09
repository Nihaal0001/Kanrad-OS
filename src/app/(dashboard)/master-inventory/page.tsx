import { Package } from "lucide-react"

import { getMaterials, getCategories } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ItemMasterTable } from "@/components/inventory/item-master-table"
import { AddMaterialSheet } from "@/components/inventory/add-material-sheet"

export default async function ItemMasterPage() {
  const [materials, categories] = await Promise.all([
    getMaterials(),
    getCategories(),
  ])

  return (
    <>
      <PageHeader
        title="Item Master"
        description="Material catalog — SKU, specs, max purchase price, and supplier info"
      >
        <AddMaterialSheet categories={categories} />
      </PageHeader>

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No materials added"
          description="Add your first material to start tracking catalog and pricing."
        />
      ) : (
        <ItemMasterTable materials={materials} categories={categories} />
      )}
    </>
  )
}

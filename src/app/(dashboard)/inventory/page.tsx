export const revalidate = 60

import Link from "next/link"
import { Package, History, IndianRupee } from "lucide-react"

import { getMaterials, getCategories } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/shared/stat-card"
import { MaterialsTable } from "@/components/inventory/materials-table"
import { stockValue } from "@/lib/costing"
import { formatCurrency } from "@/lib/utils"

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function InventoryPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const [materials, categories] = await Promise.all([
    getMaterials(),
    getCategories(),
  ])

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Live stock levels, low-stock alerts, and stock adjustments."
      >
        <Button variant="outline" asChild>
          <Link href="/inventory/history">
            <History className="h-4 w-4" />
            Stock History
          </Link>
        </Button>
      </PageHeader>

      {materials.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No materials added"
          description="Add materials in Item Master first to start tracking stock levels."
          action={{ label: "Go to Item Master", href: "/master-inventory" }}
        />
      ) : (
        <>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Stock Value"
            value={formatCurrency(materials.reduce((sum, m) => sum + stockValue(m), 0))}
            description={`${materials.length} materials · stock × avg cost`}
            icon={IndianRupee}
          />
        </div>
        <MaterialsTable materials={materials} categories={categories} initialShowLowStock={filter === "low_stock"} />
        </>
      )}
    </>
  )
}

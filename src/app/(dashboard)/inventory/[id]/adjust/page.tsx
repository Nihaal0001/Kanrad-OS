import { notFound } from "next/navigation"

import { getMaterial } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { StockAdjustmentForm } from "@/components/inventory/stock-adjustment-form"

interface AdjustStockPageProps {
  params: Promise<{ id: string }>
}

export default async function AdjustStockPage({ params }: AdjustStockPageProps) {
  const { id } = await params

  let material
  try {
    material = await getMaterial(id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title="Adjust Stock"
        description={`Stock adjustment for ${material.name}`}
      />
      <StockAdjustmentForm material={material} />
    </>
  )
}

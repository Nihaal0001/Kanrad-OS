import { notFound } from "next/navigation"

import { getPurchaseOrder } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseOrderDetail } from "@/components/inventory/purchase-order-detail"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface PurchaseOrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PurchaseOrderDetailPage({
  params,
}: PurchaseOrderDetailPageProps) {
  const { id } = await params

  let po
  try {
    po = await getPurchaseOrder(id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={po.po_number}
        description={`Supplier: ${po.supplier_name}`}
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: po.po_number },
        ]}
      >
        <Button variant="outline" asChild>
          <Link href="/inventory/purchase-orders">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>
      <PurchaseOrderDetail po={po} />
    </>
  )
}

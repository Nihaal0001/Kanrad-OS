import { notFound } from "next/navigation"

import { getOrderProduction, getProductionStages } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { QualityCheckForm } from "@/components/production/quality-check-form"

interface QCPageProps {
  params: Promise<{ id: string }>
}

export default async function QCPage({ params }: QCPageProps) {
  const { id } = await params

  let order
  try {
    order = await getOrderProduction(id)
  } catch {
    notFound()
  }

  const stages = await getProductionStages()

  return (
    <>
      <PageHeader
        title="Quality Check"
        description={`Inspection for ${order.order_number} — ${order.style_name}`}
        breadcrumbs={[
          { label: "Production", href: "/production" },
          { label: order.order_number, href: `/production/${id}` },
          { label: "QC Inspection" },
        ]}
      />
      <QualityCheckForm
        orderId={id}
        orderNumber={order.order_number}
        stages={stages}
      />
    </>
  )
}

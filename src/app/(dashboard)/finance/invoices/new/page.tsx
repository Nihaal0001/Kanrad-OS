import { getOrdersForInvoice, getOrderForInvoice } from "@/actions/finance"
import { getOrgSettings } from "@/app/(dashboard)/settings/actions"
import { PageHeader } from "@/components/shared/page-header"
import { InvoiceForm } from "@/components/finance/invoice-form"

interface Props {
  searchParams: Promise<{ orderId?: string }>
}

export default async function NewInvoicePage({ searchParams }: Props) {
  const { orderId } = await searchParams
  const [orders, preloadedOrder, org] = await Promise.all([
    getOrdersForInvoice(),
    orderId ? getOrderForInvoice(orderId) : Promise.resolve(null),
    getOrgSettings(),
  ])

  return (
    <>
      <PageHeader
        title="New Invoice"
        description="Create an invoice for a completed order"
        breadcrumbs={[
          { label: "Finance", href: "/finance/invoices" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: "New" },
        ]}
      />
      <InvoiceForm
        orders={orders}
        preloadedOrder={preloadedOrder}
        preloadedOrderId={orderId}
        orgGstin={org?.gstin ?? ""}
      />
    </>
  )
}

import { getPurchaseOrdersForInvoice } from "@/actions/purchase-invoices"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseInvoiceForm } from "@/components/finance/purchase-invoice-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewPurchaseInvoicePage() {
  const [purchaseOrders, orgGstin] = await Promise.all([
    getPurchaseOrdersForInvoice(),
    getOrgGstin(),
  ])

  return (
    <>
      <PageHeader
        title="New Purchase Invoice"
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Purchases", href: "/finance/purchases" },
          { label: "New" },
        ]}
      />
      <PurchaseInvoiceForm
        purchaseOrders={purchaseOrders}
        orgGstin={orgGstin}
      />
    </>
  )
}

async function getOrgGstin() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "org_gstin")
    .single()
  return data?.value ?? ""
}

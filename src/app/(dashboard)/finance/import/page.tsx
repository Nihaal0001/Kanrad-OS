import { getExpenseCategories } from "@/actions/expenses"
import { getFinanceImportBatch } from "@/actions/finance-import"
import { getPurchaseOrdersForInvoice } from "@/actions/purchase-invoices"
import { PageHeader } from "@/components/shared/page-header"
import { FinanceImportWorkspace } from "@/components/finance/finance-import-workspace"
import { createClient } from "@/lib/supabase/server"

export default async function FinanceImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; target?: string }>
}) {
  const params = await searchParams
  const targetHint =
    params.target === "purchase_invoice" || params.target === "expense"
      ? params.target
      : undefined

  const [batch, purchaseOrders, categories, orders] = await Promise.all([
    params.batch ? getFinanceImportBatch(params.batch) : Promise.resolve(null),
    getPurchaseOrdersForInvoice(),
    getExpenseCategories(),
    getOrders(),
  ])

  return (
    <>
      <PageHeader
        title="AI Invoice Import"
        description="Upload supplier invoices or expense receipts, review Gemini’s extracted data, and create verified drafts."
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "AI Import" },
        ]}
      />

      <FinanceImportWorkspace
        batch={batch}
        targetHint={targetHint}
        purchaseOrders={purchaseOrders}
        categories={categories}
        orders={orders}
      />
    </>
  )
}

async function getOrders() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, product_variant")
    .in("status", ["confirmed", "in_production", "completed", "dispatched"])
    .order("created_at", { ascending: false })

  return data ?? []
}

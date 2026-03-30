import { getExpenseCategories } from "@/actions/expenses"
import { PageHeader } from "@/components/shared/page-header"
import { ExpenseForm } from "@/components/finance/expense-form"
import { createClient } from "@/lib/supabase/server"

export default async function NewExpensePage() {
  const [categories, orders] = await Promise.all([
    getExpenseCategories(),
    getOrders(),
  ])

  return (
    <>
      <PageHeader
        title="New Expense"
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Expenses", href: "/finance/expenses" },
          { label: "New" },
        ]}
      />
      <ExpenseForm categories={categories} orders={orders} />
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

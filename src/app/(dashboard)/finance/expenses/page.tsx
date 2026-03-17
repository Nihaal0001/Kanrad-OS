import Link from "next/link"
import { Plus, Receipt } from "lucide-react"

import { getExpenses, getExpenseCategories } from "@/actions/expenses"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { ExpenseActions } from "@/components/finance/expense-actions"
import { ExportButton } from "@/components/finance/export-button"
import { ExpenseFilters } from "@/components/finance/expense-filters"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

const EXPORT_COLS = [
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "order_number", label: "Order #" },
  { key: "amount", label: "Amount (₹)" },
]

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const [expenses, categories] = await Promise.all([
    getExpenses({
      category_id: params.category,
      from: params.from,
      to: params.to,
    }),
    getExpenseCategories(),
  ])

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  const exportData = expenses.map((e) => ({
    expense_date: e.expense_date,
    category: e.category?.name ?? "",
    description: e.description ?? "",
    order_number: e.order?.order_number ?? "",
    amount: e.amount,
  }))

  return (
    <>
      <PageHeader
        title="Expenses"
        description={
          expenses.length > 0
            ? `${expenses.length} expenses · ₹${formatCurrency(totalAmount)} total`
            : "Track business expenses"
        }
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Expenses" },
        ]}
      >
        <ExportButton data={exportData} columns={EXPORT_COLS} filename="expenses" />
        <Link href="/finance/expenses/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Expense
          </Button>
        </Link>
      </PageHeader>

      {/* Filters */}
      <ExpenseFilters
        categories={categories}
        currentCategory={params.category}
        currentFrom={params.from}
        currentTo={params.to}
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses recorded"
          description="Start tracking business expenses like rent, electricity, transport, and more"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr_1fr_40px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Category</span>
            <span>Description</span>
            <span>Order</span>
            <span>Date</span>
            <span>Amount</span>
            <span />
          </div>

          {expenses.map((expense) => (
            <Card key={expense.id}>
              <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_40px] sm:items-center sm:gap-4">
                <Badge variant="outline" className="w-fit text-xs">
                  {expense.category?.name ?? "—"}
                </Badge>
                <p className="text-sm text-muted-foreground truncate">
                  {expense.description || "—"}
                </p>
                <div>
                  {expense.order ? (
                    <Link
                      href={`/orders/${expense.order.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {expense.order.order_number}
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{expense.expense_date}</p>
                <p className="text-sm font-semibold text-red-600">
                  -₹{formatCurrency(expense.amount)}
                </p>
                <ExpenseActions expenseId={expense.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

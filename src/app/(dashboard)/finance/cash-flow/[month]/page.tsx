import { notFound } from "next/navigation"
import Link from "next/link"
import { TrendingUp, TrendingDown, ArrowLeftRight, ArrowLeft } from "lucide-react"

import { getCashFlowMonthDetail } from "@/actions/finance-reports"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

function methodBadge(method: string) {
  const map: Record<string, string> = {
    cash: "border border-amber-500 text-amber-500",
    bank_transfer: "border border-blue-500 text-blue-500",
    cheque: "border border-purple-500 text-purple-500",
    upi: "border border-emerald-500 text-emerald-500",
    other: "border border-muted-foreground text-muted-foreground",
  }
  return map[method] ?? map["other"]
}

export default async function CashFlowMonthPage({
  params,
}: {
  params: Promise<{ month: string }>
}) {
  const { month: monthKey } = await params

  // Validate format YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(monthKey)) notFound()

  const { label, payments, expenses, purchasePayments } = await getCashFlowMonthDetail(monthKey)

  const totalInflow = payments.reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0)
  const totalPurchaseOut = purchasePayments.reduce((s: number, p: { amount: number }) => s + (p.amount ?? 0), 0)
  const totalExpenseOut = expenses.reduce((s: number, e: { amount: number }) => s + (e.amount ?? 0), 0)
  const totalOutflow = totalPurchaseOut + totalExpenseOut
  const net = totalInflow - totalOutflow

  return (
    <>
      <PageHeader
        title={label}
        description="All transactions that affected cash this month"
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Cash Flow", href: "/finance/cash-flow" },
          { label: label },
        ]}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/finance/cash-flow">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </PageHeader>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Inflow</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{fmt(totalInflow)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{payments.length} payment{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outflow</p>
          </div>
          <p className="text-2xl font-bold text-red-500">{fmt(totalOutflow)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {purchasePayments.length} purchase + {expenses.length} expense
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net</p>
          </div>
          <p className={`text-2xl font-bold ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Inflow − Outflow</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Receipts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Sales Receipts
              </span>
              <span className="text-emerald-600">{fmt(totalInflow)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No payments received</p>
            ) : (
              <div className="space-y-0">
                {payments.map((p: {
                  id: string
                  amount: number
                  method: string
                  reference: string | null
                  payment_date: string
                  invoice: { invoice_number: string; customer_name: string } | null
                }) => (
                  <div key={p.id} className="flex items-start justify-between py-2.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.invoice?.customer_name ?? "Unknown customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.invoice?.invoice_number ?? "—"} · {p.payment_date}
                        {p.reference && ` · Ref: ${p.reference}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodBadge(p.method)}`}>
                        {p.method.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">{fmt(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Purchase Payments
              </span>
              <span className="text-red-500">{fmt(totalPurchaseOut)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {purchasePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No purchase payments made</p>
            ) : (
              <div className="space-y-0">
                {purchasePayments.map((p: {
                  id: string
                  amount: number
                  method: string
                  reference: string | null
                  payment_date: string
                  invoice: { invoice_number: string | null; supplier_name: string } | null
                }) => (
                  <div key={p.id} className="flex items-start justify-between py-2.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {p.invoice?.supplier_name ?? "Unknown supplier"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.invoice?.invoice_number ?? "—"} · {p.payment_date}
                        {p.reference && ` · Ref: ${p.reference}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodBadge(p.method)}`}>
                        {p.method.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-red-500">{fmt(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Expenses
              </span>
              <span className="text-red-500">{fmt(totalExpenseOut)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses recorded</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-8">
                {expenses.map((e: {
                  id: string
                  amount: number
                  expense_date: string
                  description: string | null
                  category: { name: string } | null
                }) => (
                  <div key={e.id} className="flex items-start justify-between py-2.5 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{e.category?.name ?? "Uncategorized"}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.expense_date}{e.description ? ` · ${e.description}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 ml-4 shrink-0">{fmt(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

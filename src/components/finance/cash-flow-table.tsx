"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface CashFlowRow {
  monthKey: string
  month: string
  inflow: number
  purchaseOutflow: number
  expenseOutflow: number
  outflow: number
  net: number
  runningBalance: number
}

function fmt(n: number) {
  return `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

export function CashFlowTable({ rows }: { rows: CashFlowRow[] }) {
  if (rows.every((r) => r.inflow === 0 && r.outflow === 0)) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No cash flow data yet. Record payments and expenses to see the statement.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <th className="text-left py-2 pr-4 font-medium">Month</th>
            <th className="text-right py-2 px-3 font-medium">Sales Receipts</th>
            <th className="text-right py-2 px-3 font-medium">Purchase Payments</th>
            <th className="text-right py-2 px-3 font-medium">Expenses</th>
            <th className="text-right py-2 px-3 font-medium">Total Outflow</th>
            <th className="text-right py-2 px-3 font-medium">Net</th>
            <th className="text-right py-2 px-3 font-medium">Running Total</th>
            <th className="py-2 pl-2 w-6" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.monthKey}
              className="border-b last:border-0 hover:bg-muted/40 transition-colors group"
            >
              <td className="py-0 pr-4">
                <Link
                  href={`/finance/cash-flow/${row.monthKey}`}
                  className="flex items-center gap-1 py-2.5 font-medium hover:text-primary transition-colors"
                >
                  {row.month}
                </Link>
              </td>
              <td className="py-2.5 px-3 text-right text-emerald-600">
                {row.inflow > 0 ? fmt(row.inflow) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right text-red-500">
                {row.purchaseOutflow > 0 ? fmt(row.purchaseOutflow) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right text-red-500">
                {row.expenseOutflow > 0 ? fmt(row.expenseOutflow) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right">
                {row.outflow > 0 ? fmt(row.outflow) : <span className="text-muted-foreground">—</span>}
              </td>
              <td className={`py-2.5 px-3 text-right font-semibold ${row.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {row.net >= 0 ? "+" : "−"}{fmt(row.net)}
              </td>
              <td className={`py-2.5 px-3 text-right font-semibold ${row.runningBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {row.runningBalance >= 0 ? "" : "−"}{fmt(row.runningBalance)}
              </td>
              <td className="py-2.5 pl-2 text-muted-foreground group-hover:text-primary transition-colors">
                <ChevronRight className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-primary/30 font-semibold">
            <td className="pt-3 pr-4">Total (12 months)</td>
            <td className="pt-3 px-3 text-right text-emerald-600">
              {fmt(rows.reduce((s, r) => s + r.inflow, 0))}
            </td>
            <td className="pt-3 px-3 text-right text-red-500">
              {fmt(rows.reduce((s, r) => s + r.purchaseOutflow, 0))}
            </td>
            <td className="pt-3 px-3 text-right text-red-500">
              {fmt(rows.reduce((s, r) => s + r.expenseOutflow, 0))}
            </td>
            <td className="pt-3 px-3 text-right">
              {fmt(rows.reduce((s, r) => s + r.outflow, 0))}
            </td>
            <td className={`pt-3 px-3 text-right ${rows.reduce((s, r) => s + r.net, 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {(() => {
                const total = rows.reduce((s, r) => s + r.net, 0)
                return `${total >= 0 ? "+" : "−"}${fmt(total)}`
              })()}
            </td>
            <td className="pt-3 px-3" />
            <td className="pt-3 pl-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

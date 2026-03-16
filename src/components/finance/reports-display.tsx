"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Download } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadCSV, downloadExcel } from "@/lib/export"

interface PL {
  revenue: number
  cogs: number
  grossProfit: number
  expenses: Record<string, number>
  totalExpenses: number
  netProfit: number
}

interface GSTSide {
  cgst: number
  sgst: number
  igst: number
  total: number
}

interface GST {
  output: GSTSide
  input: GSTSide
  netLiability: number
}

interface AgingItem {
  id: string
  name: string
  amount: number
  due_date: string
  status: string
}

interface Props {
  period: string      // display label: "2026-03" or "FY 2025-26"
  mode: "month" | "fy"
  pl: PL
  gst: GST
  receivables: AgingItem[]
  payables: AgingItem[]
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
}

function getDaysOverdue(dueDate: string) {
  const due = new Date(dueDate)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
}

function ageBucket(days: number) {
  if (days === 0) return "Current"
  if (days <= 30) return "1–30 days"
  if (days <= 60) return "31–60 days"
  return "90+ days"
}

function ageBucketColor(days: number) {
  if (days === 0) return "text-emerald-600"
  if (days <= 30) return "text-amber-600"
  if (days <= 60) return "text-orange-600"
  return "text-red-600"
}

function generateMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" })
    options.push({ value, label })
  }
  return options
}

function generateFYOptions() {
  // Show last 4 financial years including current
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const currentFYStart = month >= 4 ? year : year - 1

  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 4; i++) {
    const fyStart = currentFYStart - i
    const value = `${fyStart}-${String(fyStart + 1).slice(-2)}`
    options.push({ value, label: `FY ${value}` })
  }
  return options
}

function ExportMenu({
  onCSV,
  onExcel,
  disabled,
}: {
  onCSV: () => void
  onExcel: () => Promise<void>
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || loading}>
          <Download className="h-4 w-4" />
          {loading ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCSV}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            setLoading(true)
            await onExcel()
            setLoading(false)
          }}
        >
          Export as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PLRow({ label, value, bold, indent, color }: { label: string; value: number; bold?: boolean; indent?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between py-2 border-b last:border-0 ${bold ? "font-semibold" : ""} ${indent ? "pl-4" : ""}`}>
      <span className={`text-sm ${indent ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`text-sm ${color ?? ""}`}>{fmt(value)}</span>
    </div>
  )
}

function GSTRow({ label, cgst, sgst, igst, total, bold }: { label: string; cgst: number; sgst: number; igst: number; total: number; bold?: boolean }) {
  return (
    <div className={`grid grid-cols-5 gap-2 py-2 border-b last:border-0 text-sm ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="text-right">{fmt(cgst)}</span>
      <span className="text-right">{fmt(sgst)}</span>
      <span className="text-right">{fmt(igst)}</span>
      <span className="text-right">{fmt(total)}</span>
    </div>
  )
}

export function ReportsDisplay({ period, mode, pl, gst, receivables, payables }: Props) {
  const router = useRouter()
  const monthOptions = generateMonthOptions()
  const fyOptions = generateFYOptions()

  // Derive current month value for the month selector
  const currentMonth = mode === "month" ? period : monthOptions[0].value

  function handleMonthChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/finance/reports?month=${e.target.value}`)
  }

  function handleFYChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/finance/reports?fy=${e.target.value}`)
  }

  // P&L export data
  function plCSVData() {
    const rows: Record<string, unknown>[] = [
      { item: "Revenue", amount: pl.revenue },
      { item: "COGS", amount: -pl.cogs },
      { item: "Gross Profit", amount: pl.grossProfit },
      ...Object.entries(pl.expenses).map(([cat, amt]) => ({ item: `Expense: ${cat}`, amount: -amt })),
      { item: "Total Expenses", amount: -pl.totalExpenses },
      { item: "Net Profit", amount: pl.netProfit },
    ]
    return rows
  }

  // GST export data
  function gstCSVData() {
    return [
      { type: "Output (Sales)", cgst: gst.output.cgst, sgst: gst.output.sgst, igst: gst.output.igst, total: gst.output.total },
      { type: "Input (Purchases)", cgst: gst.input.cgst, sgst: gst.input.sgst, igst: gst.input.igst, total: gst.input.total },
      { type: "Net Liability", cgst: "", sgst: "", igst: "", total: gst.netLiability },
    ]
  }

  // Aging export data
  function agingCSVData(items: AgingItem[]) {
    return items.map((item) => {
      const days = getDaysOverdue(item.due_date)
      return {
        name: item.name,
        amount: item.amount,
        due_date: item.due_date,
        age: ageBucket(days),
        status: item.status,
      }
    })
  }

  const plCols = [{ key: "item", label: "Item" }, { key: "amount", label: "Amount (₹)" }]
  const gstCols = [
    { key: "type", label: "Type" },
    { key: "cgst", label: "CGST (₹)" },
    { key: "sgst", label: "SGST (₹)" },
    { key: "igst", label: "IGST (₹)" },
    { key: "total", label: "Total (₹)" },
  ]
  const agingCols = [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount (₹)" },
    { key: "due_date", label: "Due Date" },
    { key: "age", label: "Age" },
    { key: "status", label: "Status" },
  ]

  return (
    <div>
      {/* Period Selectors */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Month:</label>
          <select
            value={mode === "month" ? currentMonth : ""}
            onChange={handleMonthChange}
            className={`rounded-md border bg-background px-3 py-1.5 text-sm ${mode === "month" ? "ring-2 ring-primary/40" : "opacity-60"}`}
          >
            {monthOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Financial Year:</label>
          <select
            value={mode === "fy" ? period.replace("FY ", "") : ""}
            onChange={handleFYChange}
            className={`rounded-md border bg-background px-3 py-1.5 text-sm ${mode === "fy" ? "ring-2 ring-primary/40" : "opacity-60"}`}
          >
            {mode !== "fy" && <option value="">— select FY —</option>}
            {fyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Tabs defaultValue="pl">
        <TabsList className="mb-4">
          <TabsTrigger value="pl">P&amp;L</TabsTrigger>
          <TabsTrigger value="gst">GST Summary</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="payables">Payables</TabsTrigger>
        </TabsList>

        {/* P&L Tab */}
        <TabsContent value="pl">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Profit &amp; Loss — {period}</CardTitle>
              <ExportMenu
                onCSV={() => downloadCSV(plCSVData(), plCols, `pl-${period}.csv`)}
                onExcel={() => downloadExcel(plCSVData(), plCols, `pl-${period}.xlsx`, "P&L")}
              />
            </CardHeader>
            <CardContent>
              <PLRow label="Revenue" value={pl.revenue} bold />
              <PLRow label="Cost of Goods Sold (COGS)" value={-pl.cogs} indent color={pl.cogs > 0 ? "text-red-600" : ""} />
              <PLRow label="Gross Profit" value={pl.grossProfit} bold color={pl.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"} />

              {Object.keys(pl.expenses).length > 0 && (
                <>
                  <div className="pt-3 pb-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expenses</p>
                  </div>
                  {Object.entries(pl.expenses).map(([cat, amt]) => (
                    <PLRow key={cat} label={cat} value={-amt} indent color="text-red-600" />
                  ))}
                  <PLRow label="Total Expenses" value={-pl.totalExpenses} bold color="text-red-600" />
                </>
              )}

              <div className="pt-3">
                <PLRow
                  label="Net Profit"
                  value={pl.netProfit}
                  bold
                  color={pl.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}
                />
              </div>

              {pl.revenue === 0 && pl.totalExpenses === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data for this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GST Summary Tab */}
        <TabsContent value="gst">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">GST Summary — {period}</CardTitle>
              <ExportMenu
                onCSV={() => downloadCSV(gstCSVData() as Record<string, unknown>[], gstCols, `gst-${period}.csv`)}
                onExcel={() => downloadExcel(gstCSVData() as Record<string, unknown>[], gstCols, `gst-${period}.xlsx`, "GST")}
              />
            </CardHeader>
            <CardContent>
              {/* Table header */}
              <div className="grid grid-cols-5 gap-2 pb-2 border-b text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Type</span>
                <span className="text-right">CGST</span>
                <span className="text-right">SGST</span>
                <span className="text-right">IGST</span>
                <span className="text-right">Total</span>
              </div>
              <GSTRow label="Output (Sales)" cgst={gst.output.cgst} sgst={gst.output.sgst} igst={gst.output.igst} total={gst.output.total} bold />
              <GSTRow label="Input (Purchases)" cgst={gst.input.cgst} sgst={gst.input.sgst} igst={gst.input.igst} total={gst.input.total} />

              <div className="mt-4 rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Net GST Liability</p>
                  <p className="text-xs text-muted-foreground">Output − Input = Payable to government</p>
                </div>
                <p className={`text-2xl font-bold ${gst.netLiability >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {fmt(Math.abs(gst.netLiability))}
                  {gst.netLiability < 0 && <span className="text-sm font-normal ml-1">(credit)</span>}
                </p>
              </div>

              {gst.output.total === 0 && gst.input.total === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No GST data for this period</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receivables Tab */}
        <TabsContent value="receivables">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Receivables Aging
                {receivables.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {fmt(receivables.reduce((s, i) => s + i.amount, 0))} outstanding
                  </span>
                )}
              </CardTitle>
              <ExportMenu
                disabled={receivables.length === 0}
                onCSV={() => downloadCSV(agingCSVData(receivables), agingCols, `receivables.csv`)}
                onExcel={() => downloadExcel(agingCSVData(receivables), agingCols, `receivables.xlsx`, "Receivables")}
              />
            </CardHeader>
            <CardContent>
              {receivables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No outstanding receivables</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b">
                    <span>Invoice / Buyer</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Due Date</span>
                    <span className="text-right">Age</span>
                  </div>
                  {receivables.map((item) => {
                    const days = getDaysOverdue(item.due_date)
                    return (
                      <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-sm py-1.5 border-b last:border-0">
                        <span className="truncate">{item.name}</span>
                        <span className="text-right font-medium">{fmt(item.amount)}</span>
                        <span className="text-right text-muted-foreground">{item.due_date}</span>
                        <span className={`text-right text-xs ${ageBucketColor(days)}`}>{ageBucket(days)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payables Tab */}
        <TabsContent value="payables">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Payables Aging
                {payables.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    — {fmt(payables.reduce((s, i) => s + i.amount, 0))} outstanding
                  </span>
                )}
              </CardTitle>
              <ExportMenu
                disabled={payables.length === 0}
                onCSV={() => downloadCSV(agingCSVData(payables), agingCols, `payables.csv`)}
                onExcel={() => downloadExcel(agingCSVData(payables), agingCols, `payables.xlsx`, "Payables")}
              />
            </CardHeader>
            <CardContent>
              {payables.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No outstanding payables</p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b">
                    <span>Invoice / Supplier</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Due Date</span>
                    <span className="text-right">Age</span>
                  </div>
                  {payables.map((item) => {
                    const days = getDaysOverdue(item.due_date)
                    return (
                      <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-sm py-1.5 border-b last:border-0">
                        <span className="truncate">{item.name}</span>
                        <span className="text-right font-medium">{fmt(item.amount)}</span>
                        <span className="text-right text-muted-foreground">{item.due_date}</span>
                        <span className={`text-right text-xs ${ageBucketColor(days)}`}>{ageBucket(days)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

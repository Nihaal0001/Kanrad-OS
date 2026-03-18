"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, XCircle, AlertCircle, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Payment {
  id: string
  amount: number
  date: string
  method: string
  reference: string | null
  label: string
  type: "sales" | "purchase"
}

interface BankRow {
  date: string
  description: string
  debit: number | null
  credit: number | null
  balance: number | null
  matchedPayment?: Payment
  matchStatus: "matched" | "unmatched" | "ignored"
}

interface Props {
  payments: Payment[]
}

function parseCSV(text: string): BankRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Auto-detect header row
  const headerLine = lines[0].toLowerCase()
  const hasHeader = headerLine.includes("date") || headerLine.includes("description") || headerLine.includes("amount")
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map((line): BankRow | null => {
      // Split by comma but respect quoted fields
      const cols: string[] = []
      let inQuote = false
      let current = ""
      for (const char of line) {
        if (char === '"') { inQuote = !inQuote; continue }
        if (char === "," && !inQuote) { cols.push(current.trim()); current = ""; continue }
        current += char
      }
      cols.push(current.trim())

      if (cols.length < 3) return null

      // Try to parse flexible formats:
      // Format 1: Date, Description, Debit, Credit, Balance
      // Format 2: Date, Description, Amount (positive=credit, negative=debit)
      // Format 3: Date, Narration, Chq, Value Date, Withdrawal, Deposit, Balance
      const date = cols[0]?.replace(/\//g, "-") ?? ""
      const description = cols[1] ?? ""

      let debit: number | null = null
      let credit: number | null = null
      let balance: number | null = null

      if (cols.length >= 5) {
        // Format 1 or 3
        debit = parseFloat(cols[cols.length - 3]?.replace(/,/g, "") ?? "") || null
        credit = parseFloat(cols[cols.length - 2]?.replace(/,/g, "") ?? "") || null
        balance = parseFloat(cols[cols.length - 1]?.replace(/,/g, "") ?? "") || null
        if (isNaN(debit ?? NaN)) debit = null
        if (isNaN(credit ?? NaN)) credit = null
        if (isNaN(balance ?? NaN)) balance = null
      } else if (cols.length >= 3) {
        // Format 2
        const amount = parseFloat(cols[2]?.replace(/,/g, "") ?? "") || null
        if (amount !== null) {
          if (amount < 0) debit = Math.abs(amount)
          else credit = amount
        }
        if (cols[3]) balance = parseFloat(cols[3]?.replace(/,/g, "") ?? "") || null
      }

      if (!date || date.length < 8) return null

      return { date, description, debit, credit, balance, matchStatus: "unmatched" }
    })
    .filter((row): row is BankRow => row !== null)
}

function matchRows(rows: BankRow[], payments: Payment[]): BankRow[] {
  const usedPaymentIds = new Set<string>()

  return rows.map((row) => {
    const rowAmount = row.credit ?? (row.debit ? -row.debit : null)
    if (!rowAmount || Math.abs(rowAmount) < 0.01) return { ...row, matchStatus: "ignored" as const }

    const amountToMatch = Math.abs(rowAmount)

    // Find best match: same amount ± 0.01, date within ±3 days
    const rowDate = new Date(row.date)
    const best = payments.find((p) => {
      if (usedPaymentIds.has(p.id)) return false
      if (Math.abs(p.amount - amountToMatch) > 0.01) return false
      const payDate = new Date(p.date)
      const diff = Math.abs((rowDate.getTime() - payDate.getTime()) / (1000 * 60 * 60 * 24))
      return diff <= 3
    })

    if (best) {
      usedPaymentIds.add(best.id)
      return { ...row, matchedPayment: best, matchStatus: "matched" as const }
    }

    return { ...row, matchStatus: "unmatched" as const }
  })
}

export function BankReconClient({ payments }: Props) {
  const [rows, setRows] = useState<BankRow[]>([])
  const [fileName, setFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!file) return
    setLoading(true)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      const matched = matchRows(parsed, payments)
      setRows(matched)
      setLoading(false)
    }
    reader.readAsText(file)
  }

  const matchedCount = rows.filter((r) => r.matchStatus === "matched").length
  const unmatchedCount = rows.filter((r) => r.matchStatus === "unmatched").length
  const ignoredCount = rows.filter((r) => r.matchStatus === "ignored").length

  function exportUnmatched() {
    const lines = ["Date,Description,Debit,Credit,Balance"]
    rows.filter((r) => r.matchStatus === "unmatched").forEach((r) => {
      lines.push(`"${r.date}","${r.description}","${r.debit ?? ""}","${r.credit ?? ""}","${r.balance ?? ""}"`)
    })
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "unmatched-transactions.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card
        className="border-2 border-dashed cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{fileName || "Drop bank statement CSV here or click to upload"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Supported: Date, Description, Debit/Credit columns. Most bank export formats work.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="pt-5 pb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-2xl font-bold text-emerald-700">{matchedCount}</p>
                </div>
                <p className="text-sm text-emerald-700">Matched</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-5 pb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{unmatchedCount}</p>
                </div>
                <p className="text-sm text-red-600">Unmatched</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="pt-5 pb-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <p className="text-2xl font-bold text-muted-foreground">{ignoredCount}</p>
                </div>
                <p className="text-sm text-muted-foreground">Ignored (zero)</p>
              </CardContent>
            </Card>
          </div>

          {unmatchedCount > 0 && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportUnmatched}>
                <Download className="mr-2 h-4 w-4" />
                Export Unmatched ({unmatchedCount})
              </Button>
            </div>
          )}

          {/* Transaction Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transactions ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
                {rows.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-4 px-5 py-3 text-sm ${
                      row.matchStatus === "matched" ? "bg-emerald-50/50" :
                      row.matchStatus === "ignored" ? "opacity-40" : ""
                    }`}
                  >
                    {/* Status Icon */}
                    <div className="shrink-0 mt-0.5">
                      {row.matchStatus === "matched" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {row.matchStatus === "unmatched" && <XCircle className="h-4 w-4 text-red-400" />}
                      {row.matchStatus === "ignored" && <AlertCircle className="h-4 w-4 text-muted-foreground" />}
                    </div>

                    {/* Date + Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">{row.date}</span>
                        {row.matchedPayment && (
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{row.matchedPayment.type}</Badge>
                        )}
                      </div>
                      <p className="truncate">{row.description}</p>
                      {row.matchedPayment && (
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Matched: {row.matchedPayment.label} · {row.matchedPayment.date}
                        </p>
                      )}
                    </div>

                    {/* Amounts */}
                    <div className="text-right shrink-0 tabular-nums">
                      {row.debit != null && row.debit > 0 && (
                        <p className="text-red-600 font-medium">-₹{row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      )}
                      {row.credit != null && row.credit > 0 && (
                        <p className="text-emerald-700 font-medium">+₹{row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      )}
                      {row.balance != null && (
                        <p className="text-xs text-muted-foreground">Bal: ₹{row.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && (
        <p className="text-center text-sm text-muted-foreground">Parsing CSV...</p>
      )}
    </div>
  )
}

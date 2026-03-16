"use client"

import { useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getInvoicesForExport } from "@/actions/finance"
import { downloadExcelStyled, downloadCSV } from "@/lib/export"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const INVOICE_COLS = [
  { key: "Invoice #", label: "Invoice #" },
  { key: "Buyer", label: "Buyer" },
  { key: "Buyer GST", label: "Buyer GST" },
  { key: "Issue Date", label: "Issue Date" },
  { key: "Due Date", label: "Due Date" },
  { key: "Subtotal", label: "Subtotal" },
  { key: "CGST", label: "CGST" },
  { key: "CGST %", label: "CGST %" },
  { key: "SGST", label: "SGST" },
  { key: "SGST %", label: "SGST %" },
  { key: "IGST", label: "IGST" },
  { key: "IGST %", label: "IGST %" },
  { key: "Tax (Total)", label: "Tax (Total)" },
  { key: "Total", label: "Total" },
  { key: "Amount Paid", label: "Amount Paid" },
  { key: "Outstanding", label: "Outstanding" },
  { key: "Currency", label: "Currency" },
  { key: "Notes", label: "Notes" },
  { key: "Created Date", label: "Created Date" },
  { key: "Status", label: "Status" },
]

export function InvoiceExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExcel() {
    setLoading(true)
    try {
      const { invoices, lineItems } = await getInvoicesForExport()
      await downloadExcelStyled(
        [
          { name: "Invoices", data: invoices, hasTotalRow: true },
          { name: "Line Items", data: lineItems, hasTotalRow: true },
        ],
        "invoices.xlsx"
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleCSV() {
    setLoading(true)
    try {
      const { invoices } = await getInvoicesForExport()
      downloadCSV(invoices, INVOICE_COLS, "invoices.csv")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <Download className="h-4 w-4" />
          {loading ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSV}>
          Export as CSV (invoices only)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel}>
          Export as Excel (.xlsx) — 2 sheets
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

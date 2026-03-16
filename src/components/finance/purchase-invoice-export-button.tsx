"use client"

import { useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getPurchaseInvoicesForExport } from "@/actions/purchase-invoices"
import { downloadExcelStyled, downloadCSV } from "@/lib/export"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const INVOICE_COLS = [
  { key: "Vendor", label: "Vendor" },
  { key: "Invoice #", label: "Invoice #" },
  { key: "Date", label: "Date" },
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
  { key: "Currency", label: "Currency" },
  { key: "Payment Terms", label: "Payment Terms" },
  { key: "Upload Date", label: "Upload Date" },
  { key: "Status", label: "Status" },
]

const LINE_ITEM_COLS = [
  { key: "Invoice Vendor", label: "Invoice Vendor" },
  { key: "Invoice #", label: "Invoice #" },
  { key: "Description", label: "Description" },
  { key: "Quantity", label: "Quantity" },
  { key: "Unit Price", label: "Unit Price" },
  { key: "Amount", label: "Amount" },
]

export function PurchaseInvoiceExportButton() {
  const [loading, setLoading] = useState(false)

  async function handleExcel() {
    setLoading(true)
    try {
      const { invoices, lineItems } = await getPurchaseInvoicesForExport()
      await downloadExcelStyled(
        [
          { name: "Invoices", data: invoices, hasTotalRow: true },
          { name: "Line Items", data: lineItems, hasTotalRow: true },
        ],
        "purchase-invoices.xlsx"
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleCSV() {
    setLoading(true)
    try {
      const { invoices } = await getPurchaseInvoicesForExport()
      downloadCSV(invoices, INVOICE_COLS, "purchase-invoices.csv")
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

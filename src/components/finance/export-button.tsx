"use client"

import { useState } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadCSV, downloadExcel } from "@/lib/export"

interface Column {
  key: string
  label: string
}

interface ExportButtonProps {
  data: Record<string, unknown>[]
  columns: Column[]
  filename: string
}

export function ExportButton({ data, columns, filename }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport(format: "csv" | "xlsx") {
    setLoading(true)
    try {
      if (format === "csv") {
        downloadCSV(data, columns, `${filename}.csv`)
      } else {
        await downloadExcel(data, columns, `${filename}.xlsx`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading || data.length === 0}>
          <Download className="h-4 w-4" />
          {loading ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          Export as Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

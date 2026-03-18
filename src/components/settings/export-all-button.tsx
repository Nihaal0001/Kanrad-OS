"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { exportAllData } from "@/actions/export-all"
import { downloadExcelStyled } from "@/lib/export"

export function ExportAllButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const result = await exportAllData()
      if ("error" in result) {
        toast.error(result.error)
        return
      }

      const sheets = Object.entries(result.data).map(([name, rows]) => ({
        name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: rows as any[],
      }))

      const filename = `JustClothing_Export_${new Date().toISOString().split("T")[0]}`
      await downloadExcelStyled(sheets, filename)
      toast.success("Export downloaded successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleExport} disabled={loading} variant="outline" className="gap-2">
      <Download className="h-4 w-4" />
      {loading ? "Exporting…" : "Export All Data"}
    </Button>
  )
}

// Client-side CSV and Excel export utilities

export function arrayToCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[]
): string {
  const header = columns.map((c) => JSON.stringify(c.label)).join(",")
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key]
      return JSON.stringify(val ?? "")
    }).join(",")
  )
  return [header, ...rows].join("\n")
}

export function downloadCSV(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string
) {
  const csv = arrayToCSV(data, columns)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  triggerDownload(blob, filename)
}

export async function downloadExcel(
  data: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string,
  sheetName = "Sheet1"
) {
  const XLSX = await import("xlsx")
  const rows = data.map((row) =>
    Object.fromEntries(columns.map((c) => [c.label, row[c.key] ?? ""]))
  )
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename)
}

export async function downloadExcelMultiSheet(
  sheets: { name: string; data: Record<string, unknown>[] }[],
  filename: string
) {
  const XLSX = await import("xlsx")
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(wb, ws, sheet.name)
  }
  XLSX.writeFile(wb, filename)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

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

// Styled export: terracotta header row, bold total row (last row), frozen header
export async function downloadExcelStyled(
  sheets: {
    name: string
    data: Record<string, unknown>[]
    hasTotalRow?: boolean  // if true, last row will be styled as total
  }[],
  filename: string
) {
  const ExcelJS = await import("exceljs")
  const workbook = new ExcelJS.Workbook()

  for (const sheet of sheets) {
    if (sheet.data.length === 0) continue
    const ws = workbook.addWorksheet(sheet.name)
    const headers = Object.keys(sheet.data[0])

    // Set columns with auto-width based on header length
    ws.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(h.length + 6, 14),
    }))

    // Add data rows (skip header — already set via columns)
    ws.addRows(sheet.data)

    // Style header row — KYRE blue background, white bold text
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } }
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
      cell.alignment = { vertical: "middle", horizontal: "center" }
      cell.border = { bottom: { style: "thin", color: { argb: "FF1D4ED8" } } }
    })

    // Style all data rows with subtle row borders
    for (let r = 2; r <= ws.rowCount; r++) {
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= headers.length) {
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFD1D5DB" } },
          }
        }
      })
    }

    // Style total row (last row) — bold black text, white background, blue top border
    if (sheet.hasTotalRow && ws.rowCount >= 2) {
      ws.getRow(ws.rowCount).eachCell({ includeEmpty: true }, (cell, col) => {
        if (col <= headers.length) {
          cell.font = { bold: true, size: 11, color: { argb: "FF000000" } }
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } }
          cell.border = {
            top: { style: "medium", color: { argb: "FF2563EB" } },
            bottom: { style: "thin", color: { argb: "FF2563EB" } },
          }
        }
      })
    }

    // Freeze header row
    ws.views = [{ state: "frozen", ySplit: 1 }]
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

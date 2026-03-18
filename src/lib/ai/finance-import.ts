import { getGeminiClient } from "@/lib/ai/gemini"

type ImportTarget = "purchase_invoice" | "expense"

type ExtractionContext = {
  suppliers: Array<{ id: string; name: string }>
  purchaseOrders: Array<{ id: string; po_number: string; supplier_name: string }>
  expenseCategories: Array<{ id: string; name: string }>
  orders: Array<{ id: string; order_number: string; style_name: string }>
}

type ExtractionResult = {
  target_type: ImportTarget
  confidence: number
  warnings: string[]
  purchase_invoice?: {
    supplier_name: string
    supplier_gst: string
    invoice_number: string
    tax_rate: number
    place_of_supply: string
    is_igst: boolean
    invoice_date: string
    due_date: string
    notes: string
    items: Array<{
      description: string
      quantity: number
      unit_price: number
      hsn_code: string
    }>
    supplier_name_hint: string
    purchase_order_hint: string
  }
  expense?: {
    category_name_hint: string
    order_number_hint: string
    amount: number
    expense_date: string
    description: string
    notes: string
  }
}

function cleanJson(raw: string) {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim()
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeDate(value: unknown) {
  const raw = safeString(value)
  if (!raw) return ""

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  return parsed.toISOString().split("T")[0]
}

function similarityScore(a: string, b: string) {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (!left || !right) return 0
  if (left === right) return 1
  if (left.includes(right) || right.includes(left)) return 0.88

  const leftWords = new Set(left.split(/\s+/))
  const rightWords = new Set(right.split(/\s+/))
  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length
  return overlap / Math.max(leftWords.size, rightWords.size, 1)
}

export function rankSuggestions(
  input: string,
  options: Array<{ id: string; label: string }>
) {
  return options
    .map((option) => ({
      ...option,
      confidence: similarityScore(input, option.label),
    }))
    .filter((option) => option.confidence > 0.2)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}

export async function extractFinanceDocument(
  file: File,
  context: ExtractionContext
): Promise<ExtractionResult> {
  const ai = getGeminiClient()
  if (!ai) {
    throw new Error("Gemini API key not configured")
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const prompt = `
You extract structured data from supplier invoices, receipts, and bills for an ERP.

Classify each document as either:
- "purchase_invoice" when it is a supplier bill with vendor invoice details and possibly line items/GST
- "expense" when it is a generic business expense receipt or bill that should become one expense entry

Return JSON only. No markdown. Use this exact shape:
{
  "target_type": "purchase_invoice" | "expense",
  "confidence": number,
  "warnings": string[],
  "purchase_invoice": {
    "supplier_name": string,
    "supplier_gst": string,
    "invoice_number": string,
    "tax_rate": number,
    "place_of_supply": string,
    "is_igst": boolean,
    "invoice_date": "YYYY-MM-DD" | "",
    "due_date": "YYYY-MM-DD" | "",
    "notes": string,
    "supplier_name_hint": string,
    "purchase_order_hint": string,
    "items": [{ "description": string, "quantity": number, "unit_price": number, "hsn_code": string }]
  },
  "expense": {
    "category_name_hint": string,
    "order_number_hint": string,
    "amount": number,
    "expense_date": "YYYY-MM-DD" | "",
    "description": string,
    "notes": string
  }
}

Rules:
- Use empty strings when unknown.
- Use 0 for unknown numeric values.
- "confidence" is 0 to 1.
- If uncertain, add a warning instead of inventing facts.
- For GST/tax, infer tax_rate and is_igst when visible.
- For purchase invoices, extract line items when present.
- For expenses, collapse into one amount and one best category hint.

Context for matching only:
Suppliers: ${JSON.stringify(context.suppliers.map((s) => s.name))}
Purchase Orders: ${JSON.stringify(context.purchaseOrders.map((po) => `${po.po_number} | ${po.supplier_name}`))}
Expense categories: ${JSON.stringify(context.expenseCategories.map((c) => c.name))}
Orders: ${JSON.stringify(context.orders.map((order) => `${order.order_number} | ${order.style_name}`))}
`.trim()

  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: file.type || "application/octet-stream",
        data: bytes.toString("base64"),
      },
    },
  ])

  const raw = cleanJson(result.response.text())
  const parsed = JSON.parse(raw) as ExtractionResult

  return {
    target_type: parsed.target_type === "expense" ? "expense" : "purchase_invoice",
    confidence: Math.min(1, Math.max(0, safeNumber(parsed.confidence))),
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.map((warning) => safeString(warning)).filter(Boolean)
      : [],
    purchase_invoice: parsed.purchase_invoice
      ? {
          supplier_name: safeString(parsed.purchase_invoice.supplier_name || parsed.purchase_invoice.supplier_name_hint),
          supplier_gst: safeString(parsed.purchase_invoice.supplier_gst),
          invoice_number: safeString(parsed.purchase_invoice.invoice_number),
          tax_rate: safeNumber(parsed.purchase_invoice.tax_rate),
          place_of_supply: safeString(parsed.purchase_invoice.place_of_supply),
          is_igst: Boolean(parsed.purchase_invoice.is_igst),
          invoice_date: normalizeDate(parsed.purchase_invoice.invoice_date),
          due_date: normalizeDate(parsed.purchase_invoice.due_date),
          notes: safeString(parsed.purchase_invoice.notes),
          supplier_name_hint: safeString(parsed.purchase_invoice.supplier_name_hint || parsed.purchase_invoice.supplier_name),
          purchase_order_hint: safeString(parsed.purchase_invoice.purchase_order_hint),
          items: Array.isArray(parsed.purchase_invoice.items)
            ? parsed.purchase_invoice.items.map((item) => ({
                description: safeString(item.description),
                quantity: Math.max(0, safeNumber(item.quantity)),
                unit_price: Math.max(0, safeNumber(item.unit_price)),
                hsn_code: safeString(item.hsn_code),
              })).filter((item) => item.description || item.quantity || item.unit_price)
            : [],
        }
      : undefined,
    expense: parsed.expense
      ? {
          category_name_hint: safeString(parsed.expense.category_name_hint),
          order_number_hint: safeString(parsed.expense.order_number_hint),
          amount: Math.max(0, safeNumber(parsed.expense.amount)),
          expense_date: normalizeDate(parsed.expense.expense_date),
          description: safeString(parsed.expense.description),
          notes: safeString(parsed.expense.notes),
        }
      : undefined,
  }
}

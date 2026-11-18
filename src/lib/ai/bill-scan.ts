import { getGeminiClient } from "@/lib/ai/gemini"

export type BillDirection = "purchase" | "sales" | "unknown"

export interface ExtractedBillLine {
  /** Item / material code exactly as printed, "" if none */
  code: string
  /** Item description exactly as printed */
  name: string
  hsn: string
  quantity: number | null
  unit: string
  /** Rate per unit before tax, null when unreadable */
  unit_price: number | null
  confidence: number
  note: string
}

export interface ExtractedBill {
  direction: BillDirection
  seller_name: string
  seller_gst: string
  seller_address: string
  seller_contact: string
  buyer_name: string
  buyer_gst: string
  buyer_address: string
  place_of_supply: string
  reverse_charge: boolean
  /** Printed due date, YYYY-MM-DD or "" (shown for reference — due dates follow payment terms) */
  due_date: string
  /** PO / order reference printed on the bill */
  po_reference: string
  /** Terms, remarks or bank notes worth keeping */
  notes: string
  invoice_number: string
  /** YYYY-MM-DD or "" */
  invoice_date: string
  /** Total GST rate in %, null if it cannot be worked out */
  tax_rate: number | null
  is_igst: boolean
  /** Grand total printed on the bill, for cross-checking the lines */
  total_amount: number | null
  lines: ExtractedBillLine[]
  warnings: string[]
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[,₹\s]/g, "")) : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

function isoDate(v: unknown) {
  const raw = str(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(raw).getTime()) ? raw : ""
}

function cleanJson(raw: string) {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim()
}

const PROMPT = `
You read a photographed or scanned Indian GST tax invoice / bill and transcribe it.

Return JSON only, no markdown, exactly this shape:
{
  "seller_name": string, "seller_gst": string, "seller_address": string, "seller_contact": string,
  "buyer_name": string, "buyer_gst": string, "buyer_address": string,
  "place_of_supply": string, "reverse_charge": boolean,
  "due_date": "YYYY-MM-DD" | "", "po_reference": string, "notes": string,
  "invoice_number": string,
  "invoice_date": "YYYY-MM-DD" | "",
  "tax_rate": number | null,
  "is_igst": boolean,
  "total_amount": number | null,
  "warnings": string[],
  "lines": [{ "code": string, "name": string, "hsn": string, "quantity": number | null, "unit": string, "unit_price": number | null, "confidence": number, "note": string }]
}

Rules — accuracy matters more than completeness:
- Transcribe exactly what is printed. Do NOT correct, expand or normalise item names or codes.
- "seller_name" is who issued the bill (the supplier / "From"); "buyer_name" is who it is billed to ("Bill to" / "Buyer").
- One entry per item row. Skip blank rows and tax / total rows. Never invent rows.
- "unit_price" is the rate per unit BEFORE tax. If only a tax-inclusive amount is shown, use null and say so in "note".
- "quantity" and "unit_price" must be null when the digits are unclear. Never guess a number.
- "seller_contact" is the seller's phone or email. Addresses are single-line. "place_of_supply" is the state printed (e.g. "Maharashtra"), "" if absent.
- "reverse_charge" is true only when the bill says reverse charge applies. "due_date" only if a due date is printed. "po_reference" is any PO / order number the bill refers to.
- "notes" is short: payment terms, remarks or declarations worth keeping, "" if none.
- "tax_rate" is the combined GST % (CGST+SGST, or IGST). "is_igst" is true only when IGST is charged.
- "confidence" is 0 to 1 for how legible that row is; use below 0.6 for anything you had to squint at.
- "total_amount" is the grand total printed on the bill, or null.
- If the image is not a bill, is blurry, cropped or rotated, return no lines and explain in "warnings".
- Put anything else the reviewer should know in "warnings".
`.trim()

/** Which side of the bill is us? Compared against a list of our own names. */
export function detectDirection(seller: string, buyer: string, ownNames: string[]): BillDirection {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
  const own = ownNames.map(norm).filter((n) => n.length >= 3)
  const hit = (name: string) => {
    const n = norm(name)
    return n.length >= 4 && own.some((o) => n.includes(o) || o.includes(n))
  }
  const sellerIsUs = hit(seller)
  const buyerIsUs = hit(buyer)
  if (buyerIsUs && !sellerIsUs) return "purchase"
  if (sellerIsUs && !buyerIsUs) return "sales"
  return "unknown"
}

export async function extractBill(bytes: Buffer, mimeType: string): Promise<ExtractedBill> {
  const ai = getGeminiClient()
  if (!ai) throw new Error("Gemini API key not configured")

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })

  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("503 reader timed out")), ms))])

  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        model.generateContent([
          { text: PROMPT },
          { inlineData: { mimeType, data: bytes.toString("base64") } },
        ]),
        40_000
      )
      const parsed = JSON.parse(cleanJson(result.response.text())) as Record<string, unknown>
      const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as Array<Record<string, unknown>>) : []

      const lines: ExtractedBillLine[] = rawLines
        .map((l) => {
          const quantity = num(l.quantity)
          return {
            code: str(l.code),
            name: str(l.name),
            hsn: str(l.hsn),
            quantity: quantity !== null && quantity > 0 ? quantity : null,
            unit: str(l.unit),
            unit_price: num(l.unit_price),
            confidence: Math.min(1, Math.max(0, Number(l.confidence) || 0)),
            note: str(l.note),
          }
        })
        .filter((l) => l.code || l.name || l.quantity !== null)

      return {
        direction: "unknown",
        seller_name: str(parsed.seller_name),
        seller_gst: str(parsed.seller_gst),
        seller_address: str(parsed.seller_address),
        seller_contact: str(parsed.seller_contact),
        buyer_name: str(parsed.buyer_name),
        buyer_gst: str(parsed.buyer_gst),
        buyer_address: str(parsed.buyer_address),
        place_of_supply: str(parsed.place_of_supply),
        reverse_charge: parsed.reverse_charge === true,
        due_date: isoDate(parsed.due_date),
        po_reference: str(parsed.po_reference),
        notes: str(parsed.notes),
        invoice_number: str(parsed.invoice_number),
        invoice_date: isoDate(parsed.invoice_date),
        tax_rate: num(parsed.tax_rate),
        is_igst: parsed.is_igst === true,
        total_amount: num(parsed.total_amount),
        lines,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(str).filter(Boolean) : [],
      }
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : ""
      const transient = msg.includes("503") || msg.includes("429") || msg.includes("fetch failed") || err instanceof SyntaxError
      if (!transient || attempt === 1) break
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not read the bill")
}

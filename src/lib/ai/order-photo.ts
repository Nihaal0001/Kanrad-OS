import { getGeminiClient } from "@/lib/ai/gemini"

export interface ExtractedOrderLine {
  /** Product code exactly as written, "" if the column is blank */
  code: string
  /** Item description exactly as written */
  name: string
  /** null when the digits cannot be read with confidence */
  quantity: number | null
  /** 0–1 — how legible this whole row is */
  confidence: number
  note: string
}

export interface ExtractedOrderSheet {
  customer_hint: string
  /** YYYY-MM-DD or "" */
  deadline: string
  lines: ExtractedOrderLine[]
  warnings: string[]
}

function cleanJson(raw: string) {
  return raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim()
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

function qty(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/,/g, "").trim()) : NaN
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null
}

function isoDate(v: unknown) {
  const raw = str(v)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(new Date(raw).getTime()) ? raw : ""
}

const PROMPT = `
You read a photographed, handwritten ORDER SHEET for a houseware factory and transcribe it.
The sheet has a header (customer, date needed) and a table with columns: Sr, Product Code, Item, Quantity.

Return JSON only, no markdown, exactly this shape:
{
  "customer_hint": string,
  "deadline": "YYYY-MM-DD" | "",
  "warnings": string[],
  "lines": [{ "code": string, "name": string, "quantity": number | null, "confidence": number, "note": string }]
}

Rules — accuracy matters more than completeness:
- Transcribe each written row as it is written. Do NOT correct, expand or normalise item names, and do NOT pick products from any list.
- One entry per row. Skip blank rows. Never invent rows.
- "quantity": whole pieces only. If the digits are unclear, crossed out, or ambiguous (e.g. 1 vs 7, 5 vs 6), use null and say so in "note". Never guess a number.
- "confidence": 0 to 1 for how legible that row is. Use below 0.6 for anything you had to squint at.
- Leave "code" as "" when the code column is blank for that row.
- "deadline": only if a needed-by / delivery date is clearly written; otherwise "".
- If the image is not an order sheet, is blurry, cropped, or rotated, return no lines and explain in "warnings".
- Put anything else the reviewer should know (cut-off edges, overwritten text, extra notes) in "warnings".
`.trim()

export async function extractOrderSheet(
  bytes: Buffer,
  mimeType: string
): Promise<ExtractedOrderSheet> {
  const ai = getGeminiClient()
  if (!ai) throw new Error("Gemini API key not configured")

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })

  let lastError: unknown
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("503 reader timed out")), ms))])

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(
        model.generateContent([
          { text: PROMPT },
          { inlineData: { mimeType, data: bytes.toString("base64") } },
        ]),
        24_000
      )
      const parsed = JSON.parse(cleanJson(result.response.text())) as Record<string, unknown>
      const rawLines = Array.isArray(parsed.lines) ? (parsed.lines as Array<Record<string, unknown>>) : []

      const lines = rawLines
        .map((l) => ({
          code: str(l.code),
          name: str(l.name),
          quantity: qty(l.quantity),
          confidence: Math.min(1, Math.max(0, Number(l.confidence) || 0)),
          note: str(l.note),
        }))
        .filter((l) => l.code || l.name || l.quantity !== null)

      return {
        customer_hint: str(parsed.customer_hint),
        deadline: isoDate(parsed.deadline),
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
  throw lastError instanceof Error ? lastError : new Error("Could not read the order sheet")
}

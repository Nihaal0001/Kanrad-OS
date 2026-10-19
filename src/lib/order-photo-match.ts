// Pure matching of handwritten order lines to the BOM product list.
// Rule of thumb: a code hit or exact name is trusted; anything weaker is
// surfaced for a human to confirm; anything else stays unmatched. Never guess.

export interface MatchProduct {
  id: string
  name: string
  sku: string
}

export interface ProductCandidate {
  id: string
  name: string
  sku: string
  score: number
}

export type MatchStatus = "matched" | "suggested" | "unmatched"

export interface LineMatch {
  status: MatchStatus
  productId: string | null
  method: "code" | "name" | "fuzzy" | null
  candidates: ProductCandidate[]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")
const tokens = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0)

function nameScore(input: string, target: string): number {
  const a = norm(input)
  const b = norm(target)
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = new Set(tokens(input))
  const tb = new Set(tokens(target))
  if (ta.size === 0 || tb.size === 0) return 0
  const overlap = [...ta].filter((t) => tb.has(t)).length
  // Jaccard: penalises both missing and extra words, so "Tawa 10" does not
  // fully match "Tawa 12" and "Kadai" does not fully match "Kadai Lid".
  return overlap / (ta.size + tb.size - overlap)
}

export const SUGGEST_MIN_SCORE = 0.8
export const SUGGEST_MIN_MARGIN = 0.15
const CANDIDATE_MIN_SCORE = 0.3

export function matchProduct(
  line: { code: string; name: string },
  products: MatchProduct[]
): LineMatch {
  const code = norm(line.code)
  if (code) {
    const hits = products.filter((p) => norm(p.sku) === code)
    if (hits.length === 1) {
      // A misread code can land on a different valid SKU: if a written name
      // is present and clearly disagrees, make a human confirm it.
      const disagrees = !!line.name && nameScore(line.name, hits[0].name) < 0.3
      return {
        status: disagrees ? "suggested" : "matched",
        productId: hits[0].id,
        method: "code",
        candidates: [{ ...hits[0], score: 1 }],
      }
    }
  }

  const query = line.name || line.code
  const ranked = products
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      score: Math.max(nameScore(query, p.name), line.code ? nameScore(line.code, p.sku) : 0),
    }))
    .filter((c) => c.score >= CANDIDATE_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)

  const best = ranked[0]
  const second = ranked[1]
  if (!best) return { status: "unmatched", productId: null, method: null, candidates: [] }

  if (best.score === 1 && (!second || second.score < 1)) {
    return { status: "matched", productId: best.id, method: "name", candidates: ranked }
  }
  if (best.score >= SUGGEST_MIN_SCORE && (!second || best.score - second.score >= SUGGEST_MIN_MARGIN)) {
    return { status: "suggested", productId: best.id, method: "fuzzy", candidates: ranked }
  }
  return { status: "unmatched", productId: null, method: null, candidates: ranked }
}

/** Order-of-lines-independent fingerprint, used to spot a re-photographed sheet. */
export function orderSignature(lines: Array<{ product: string; qty: number }>): string {
  const totals = new Map<string, number>()
  for (const l of lines) totals.set(norm(l.product), (totals.get(norm(l.product)) ?? 0) + l.qty)
  return [...totals.entries()]
    .map(([product, qty]) => `${product}x${qty}`)
    .sort()
    .join("|")
}

export function rankCustomer(
  hint: string,
  customers: Array<{ id: string; name: string; company: string | null }>
): string | null {
  if (!hint.trim()) return null
  const scored = customers
    .map((c) => ({
      id: c.id,
      score: Math.max(nameScore(hint, c.name), c.company ? nameScore(hint, c.company) : 0),
    }))
    .sort((a, b) => b.score - a.score)
  const [best, second] = scored
  if (!best || best.score < SUGGEST_MIN_SCORE) return null
  if (second && best.score - second.score < SUGGEST_MIN_MARGIN) return null
  return best.id
}

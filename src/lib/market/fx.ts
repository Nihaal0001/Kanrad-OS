// USD→INR exchange rates. Historical month-end rates come from frankfurter.dev
// (ECB reference rates, free, no key) so backfilled commodity prices convert
// at that month's rate rather than today's. Spot keeps the existing
// open.er-api.com behavior with frankfurter as backup.

/** Last available daily USD/INR rate on or before each month-end, for every
 *  month in [startMonth, endMonth] ("YYYY-MM"). Missing months are absent. */
export async function getUsdInrMonthEnds(
  startMonth: string,
  endMonth: string
): Promise<Map<string, number>> {
  const from = `${startMonth}-01`
  const [ey, em] = endMonth.split("-").map(Number)
  const to = `${endMonth}-${String(new Date(ey, em, 0).getDate()).padStart(2, "0")}`

  const out = new Map<string, number>()
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/${from}..${to}?base=USD&symbols=INR`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) }
    )
    if (!res.ok) return out
    const data = await res.json()
    const rates: Record<string, { INR?: number }> = data?.rates ?? {}
    // days are chronological in practice, but sort for safety — last write
    // per month wins, i.e. the latest trading day of that month
    for (const day of Object.keys(rates).sort()) {
      const inr = rates[day]?.INR
      if (inr) out.set(day.slice(0, 7), inr)
    }
  } catch {
    // caller falls back to spot
  }
  return out
}

/** Current USD/INR rate; layered fallbacks, never throws. */
export async function getUsdInrSpot(): Promise<number> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (data?.rates?.INR) return data.rates.INR
  } catch {
    // fall through
  }
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (data?.rates?.INR) return data.rates.INR
  } catch {
    // fall through
  }
  return 84
}

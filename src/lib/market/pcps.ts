// IMF Primary Commodity Price System (PCPS) client — free, no API key.
// Returns monthly average benchmark prices in USD (per metric tonne for the
// indicators we use). Response is SDMX 2.1 StructureSpecific XML; observations
// are flat <Obs TIME_PERIOD="YYYY-MM" OBS_VALUE="…"/> tags inside <Series>
// blocks, so two regexes parse it without any XML dependency.

export type PcpsIndicator = "PALUM" | "PNICK" | "PIORECR" | "PCOALAU"

export interface PcpsPoint {
  month: string // "YYYY-MM"
  usd: number
}

export async function fetchPcpsMonthly(
  indicators: PcpsIndicator[],
  startPeriod: string // "YYYY-MM"
): Promise<Map<PcpsIndicator, PcpsPoint[]>> {
  const key = `G001.${indicators.join("+")}.USD.M`
  const url = `https://api.imf.org/external/sdmx/2.1/data/PCPS/${key}?startPeriod=${startPeriod}`

  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`IMF PCPS ${res.status}`)
  const xml = await res.text()

  const out = new Map<PcpsIndicator, PcpsPoint[]>()

  const seriesRe = /<Series ([^>]*)>([\s\S]*?)<\/Series>/g
  let s: RegExpExecArray | null
  while ((s = seriesRe.exec(xml)) !== null) {
    const attrs = s[1]
    const body = s[2]
    const ind = attrs.match(/INDICATOR="(\w+)"/)?.[1] as PcpsIndicator | undefined
    if (!ind || !indicators.includes(ind)) continue

    const points: PcpsPoint[] = []
    const obsRe = /<Obs ([^/>]*)\/>/g
    let o: RegExpExecArray | null
    while ((o = obsRe.exec(body)) !== null) {
      const period = o[1].match(/TIME_PERIOD="(\d{4})-M(\d{2})"/)
      const value = o[1].match(/OBS_VALUE="([\d.eE+-]+)"/)
      if (!period || !value) continue
      const usd = Number(value[1])
      if (!Number.isFinite(usd) || usd <= 0) continue
      points.push({ month: `${period[1]}-${period[2]}`, usd })
    }
    points.sort((a, b) => a.month.localeCompare(b.month))
    out.set(ind, points)
  }

  return out
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

interface TopPartiesCardProps {
  title: string
  description: string
  entries: { party: string; amount: number }[]
  /** inline bar color — matches the in/out identity used across the dashboard */
  variant: "incoming" | "outgoing"
}

// Same validated pair as the charts: cyan = money in, amber = money out.
const BAR_COLOR = { incoming: "#0891b2", outgoing: "#d97706" }

export function TopPartiesCard({ title, description, entries, variant }: TopPartiesCardProps) {
  const max = Math.max(...entries.map((e) => e.amount), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No data yet</p>
        ) : (
          <ul className="space-y-3">
            {entries.map((e) => (
              <li key={e.party}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{e.party}</span>
                  <span className="shrink-0 font-medium tabular-nums">{formatCurrency(e.amount)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${Math.max((e.amount / max) * 100, 2)}%`, backgroundColor: BAR_COLOR[variant] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

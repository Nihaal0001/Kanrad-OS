import { cn } from "@/lib/utils"

interface StockLevelBarProps {
  current: number
  minimum: number
  className?: string
}

export function StockLevelBar({ current, minimum, className }: StockLevelBarProps) {
  const isLow = current <= minimum && minimum > 0
  const isOut = current <= 0

  // Calculate fill percentage (cap at 100%, use minimum * 2 as max reference)
  const maxRef = Math.max(minimum * 2, current, 1)
  const fillPct = Math.min((current / maxRef) * 100, 100)

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 w-20 rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isOut
              ? "bg-destructive"
              : isLow
              ? "bg-amber-500"
              : "bg-emerald-500"
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs tabular-nums",
          isOut
            ? "text-destructive font-medium"
            : isLow
            ? "text-amber-600 font-medium"
            : "text-muted-foreground"
        )}
      >
        {current.toLocaleString("en-IN")}
      </span>
    </div>
  )
}

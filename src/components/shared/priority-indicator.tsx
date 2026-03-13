import { cn } from "@/lib/utils"

const priorityColors: Record<string, string> = {
  low: "bg-muted-foreground/40",
  normal: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-red-600",
}

const priorityLabels: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
}

interface PriorityIndicatorProps {
  priority: string
  showLabel?: boolean
  className?: string
}

export function PriorityIndicator({
  priority,
  showLabel = false,
  className,
}: PriorityIndicatorProps) {
  const dotColor = priorityColors[priority] ?? "bg-muted-foreground/40"
  const label =
    priorityLabels[priority] ??
    priority.replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn("h-2 w-2 shrink-0 rounded-full", dotColor)}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </span>
  )
}

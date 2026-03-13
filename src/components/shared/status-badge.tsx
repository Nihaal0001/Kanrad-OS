import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }
> = {
  // Order statuses
  draft: { label: "Draft", variant: "outline" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  in_production: { label: "In Production", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  dispatched: { label: "Dispatched", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },

  // Task statuses
  todo: { label: "To Do", variant: "outline" },
  in_progress: { label: "In Progress", variant: "warning" },
  done: { label: "Done", variant: "success" },

  // General
  pending: { label: "Pending", variant: "outline" },
  blocked: { label: "Blocked", variant: "destructive" },

  // Priorities
  low: { label: "Low", variant: "outline" },
  normal: { label: "Normal", variant: "secondary" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  if (!config) {
    const label = status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())

    return (
      <Badge variant="outline" className={className}>
        {label}
      </Badge>
    )
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

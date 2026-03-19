import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  trend?: { value: number; positive: boolean }
  className?: string
  href?: string
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  href,
}: StatCardProps) {
  const card = (
    <Card
      className={cn(
        "h-full transition-shadow duration-200 hover:shadow-md",
        href && "cursor-pointer hover:border-primary/30",
        className
      )}
    >
      <CardContent className="flex h-full p-5 sm:p-6">
        <div className="flex w-full items-start justify-between gap-3 sm:gap-4">
          <div className="flex min-h-[104px] flex-1 flex-col sm:min-h-[128px]">
            <p className="text-sm font-medium leading-tight text-muted-foreground sm:text-base">{title}</p>
            <p className="mt-2 text-3xl font-bold leading-none sm:text-4xl">{value}</p>
            {description && (
              <p className="mt-3 max-w-[18ch] text-sm leading-snug text-muted-foreground sm:mt-4 sm:max-w-none sm:text-sm">{description}</p>
            )}
            {trend && (
              <div
                className={cn(
                  "mt-3 flex items-center gap-1 text-sm font-medium sm:mt-4",
                  trend.positive ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.positive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span>{trend.value}%</span>
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-accent p-2.5 sm:p-3">
            <Icon className="h-5 w-5 text-muted-foreground sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href} className="block h-full">{card}</Link>
  }
  return card
}

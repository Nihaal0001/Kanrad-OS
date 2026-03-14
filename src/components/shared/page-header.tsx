import { cn } from "@/lib/utils"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs"

interface PageHeaderProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  breadcrumbs?: BreadcrumbItem[]
}

export function PageHeader({
  title,
  description,
  children,
  className,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-8 space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  )
}

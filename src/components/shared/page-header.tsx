import Link from "next/link"
import { ArrowLeft } from "lucide-react"

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
  const previousBreadcrumb = breadcrumbs
    ?.slice(0, -1)
    .toReversed()
    .find((item) => item.href)

  return (
    <div className={cn("mb-8 space-y-3", className)}>
      {previousBreadcrumb?.href && (
        <Link
          href={previousBreadcrumb.href}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-sm font-medium text-foreground/85 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/25 hover:text-foreground sm:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {previousBreadcrumb.label}
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && (
            <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{children}</div>
        )}
      </div>
    </div>
  )
}

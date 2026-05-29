import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <Skeleton className="h-5 w-36" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}

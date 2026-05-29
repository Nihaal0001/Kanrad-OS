import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2"><Skeleton className="h-8 w-36" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

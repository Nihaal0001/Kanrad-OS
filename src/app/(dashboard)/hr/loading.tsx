import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-4 w-48" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-20 rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

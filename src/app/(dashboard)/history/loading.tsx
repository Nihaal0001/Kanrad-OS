import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-48" /></div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-40" /><Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

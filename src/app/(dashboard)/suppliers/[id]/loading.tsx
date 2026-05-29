import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><Skeleton className="h-8 w-8" /><Skeleton className="h-6 w-48" /></div>
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-10 w-full" /></div>
        ))}
        <Skeleton className="h-10 w-32 mt-2" />
      </div>
    </div>
  )
}

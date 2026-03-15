import { Skeleton } from "@/components/ui/skeleton"

export default function InventoryLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <div className="ml-auto flex items-center gap-3">
                <Skeleton className="h-2 w-24 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

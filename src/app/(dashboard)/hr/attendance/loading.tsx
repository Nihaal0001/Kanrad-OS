import { Skeleton } from "@/components/ui/skeleton"

export default function AttendanceLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex gap-3">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-20 rounded-full ml-auto" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

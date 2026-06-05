import { Skeleton } from "@/components/ui/skeleton"
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">{Array.from({length:3}).map((_,i)=><div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3"><Skeleton className="h-4 w-28"/><Skeleton className="h-8 w-16"/><Skeleton className="h-3 w-36"/></div>)}</div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4"><Skeleton className="h-5 w-40"/><Skeleton className="h-64 w-full"/></div>
    </div>
  )
}

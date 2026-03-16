import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AgingItem {
  id: string
  name: string
  amount: number
  due_date: string
  status: string
}

interface AgingTableProps {
  title: string
  items: AgingItem[]
  linkPrefix?: string
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

function getDaysOverdue(dueDate: string) {
  const due = new Date(dueDate)
  const today = new Date()
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
}

function getBucket(days: number) {
  if (days === 0) return "Current"
  if (days <= 30) return "1-30 days"
  if (days <= 60) return "31-60 days"
  return "90+ days"
}

function getBucketColor(days: number) {
  if (days === 0) return "text-emerald-600"
  if (days <= 30) return "text-amber-600"
  if (days <= 60) return "text-orange-600"
  return "text-red-600"
}

export function AgingTable({ title, items }: AgingTableProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No outstanding items</p>
        </CardContent>
      </Card>
    )
  }

  const total = items.reduce((s, i) => s + i.amount, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="text-sm font-semibold">₹{formatCurrency(total)}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b">
            <span>Name</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Age</span>
          </div>
          {items.map((item) => {
            const days = getDaysOverdue(item.due_date)
            return (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr] gap-2 text-sm py-1">
                <span className="truncate">{item.name}</span>
                <span className="text-right font-medium">₹{formatCurrency(item.amount)}</span>
                <span className={`text-right text-xs ${getBucketColor(days)}`}>
                  {getBucket(days)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

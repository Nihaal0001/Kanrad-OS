import Link from "next/link"
import { Plus, FileX } from "lucide-react"
import { getCreditNotes } from "@/actions/credit-notes"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

export default async function CreditNotesPage() {
  const notes = await getCreditNotes()

  return (
    <>
      <PageHeader
        title="Credit Notes"
        description="Returns and adjustments to issued invoices"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Credit Notes" }]}
      >
        <Link href="/finance/credit-notes/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Credit Note
          </Button>
        </Link>
      </PageHeader>

      {notes.length === 0 ? (
        <EmptyState
          icon={FileX}
          title="No credit notes"
          description="Credit notes are created when buyers return goods or when corrections are needed on invoices"
          action={{ label: "Create Credit Note", href: "/finance/credit-notes/new" }}
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_100px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Credit Note #</span>
            <span>Buyer</span>
            <span>Reason</span>
            <span>Total</span>
            <span>Status</span>
          </div>
          {notes.map((note) => (
            <Link key={note.id} href={`/finance/credit-notes/${note.id}`}>
              <Card className="transition-colors hover:bg-accent/30 cursor-pointer">
                <CardContent className="grid grid-cols-[1fr_1fr_1fr_1fr_100px] items-center gap-4 p-4">
                  <p className="text-sm font-mono font-medium">{note.credit_note_number || "—"}</p>
                  <p className="text-sm">{note.buyer_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{note.reason || "—"}</p>
                  <p className="text-sm font-semibold text-[hsl(16,65%,55%)]">₹{fmt(note.total_amount)}</p>
                  <Badge className={cn(STATUS_STYLES[note.status], "text-xs")}>{note.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

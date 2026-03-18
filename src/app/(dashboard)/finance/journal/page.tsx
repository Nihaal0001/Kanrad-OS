import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getJournalEntries } from "@/actions/accounting"
import { JournalEntriesTable } from "@/components/finance/journal-entries-table"
import { JournalFilters } from "./journal-filters"

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ referenceType?: string; from?: string; to?: string; search?: string }>
}) {
  const params = await searchParams
  const entries = await getJournalEntries({
    referenceType: params.referenceType,
    from: params.from,
    to: params.to,
    search: params.search,
  })

  const totalDebits = entries.reduce(
    (sum, e) => sum + e.journal_entry_lines.reduce((s: number, l: { debit: number }) => s + Number(l.debit), 0),
    0
  )
  const totalCredits = entries.reduce(
    (sum, e) => sum + e.journal_entry_lines.reduce((s: number, l: { credit: number }) => s + Number(l.credit), 0),
    0
  )

  return (
    <>
      <PageHeader
        title="Journal Entries"
        description="Double-entry accounting — every financial transaction auto-creates a journal entry"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Journal" }]}
      >
      </PageHeader>

      <div className="space-y-4">
        <JournalFilters />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold">{entries.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Debits</p>
              <p className="text-2xl font-bold">₹{totalDebits.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Credits</p>
              <p className="text-2xl font-bold">₹{totalCredits.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Balanced</p>
              <p className={`text-2xl font-bold ${Math.abs(totalDebits - totalCredits) < 0.01 ? "text-emerald-600" : "text-red-600"}`}>
                {Math.abs(totalDebits - totalCredits) < 0.01 ? "Yes" : "No"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <JournalEntriesTable entries={entries} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

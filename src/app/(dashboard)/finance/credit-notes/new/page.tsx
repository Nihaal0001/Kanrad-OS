import { PageHeader } from "@/components/shared/page-header"
import { CreditNoteForm } from "@/components/finance/credit-note-form"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

interface Props {
  searchParams: Promise<{ invoice_id?: string }>
}

export default async function NewCreditNotePage({ searchParams }: Props) {
  const { invoice_id } = await searchParams
  const supabase = await createClient()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, total_amount")
    .in("status", ["sent", "paid", "partially_paid"])
    .order("issue_date", { ascending: false })

  return (
    <>
      <PageHeader
        title="New Credit Note"
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Credit Notes", href: "/finance/credit-notes" },
          { label: "New" },
        ]}
      />
      <div className="max-w-3xl">
        <Card>
          <CardContent className="pt-6">
            <CreditNoteForm
              invoices={invoices ?? []}
              prefillInvoiceId={invoice_id}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}

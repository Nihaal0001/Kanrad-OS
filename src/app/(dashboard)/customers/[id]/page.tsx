import { notFound } from "next/navigation"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { getCustomer } from "@/actions/customers"
import { DeleteContactButton } from "@/components/contacts/delete-contact-button"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let customer
  try {
    customer = await getCustomer(id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={customer.name}
        description={customer.company ?? undefined}
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name }]}
      >
        <Link href={`/customers/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
        <DeleteContactButton id={id} mode="customer" name={customer.name} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {customer.email && <div><p className="text-sm text-muted-foreground">Email</p><p>{customer.email}</p></div>}
                {customer.phone && <div><p className="text-sm text-muted-foreground">Phone</p><p>{customer.phone}</p></div>}
                {customer.gstin && <div><p className="text-sm text-muted-foreground">GSTIN</p><p className="font-mono text-sm">{customer.gstin}</p></div>}
              </div>
              {(customer.address || customer.city || customer.state) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p>{[customer.address, customer.city, customer.state].filter(Boolean).join(", ")}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(customer.bank_name || customer.bank_account || customer.bank_ifsc) && (
            <Card>
              <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {customer.bank_name && <div><p className="text-sm text-muted-foreground">Bank</p><p>{customer.bank_name}</p></div>}
                {customer.bank_account && <div><p className="text-sm text-muted-foreground">Account</p><p className="font-mono text-sm">{customer.bank_account}</p></div>}
                {customer.bank_ifsc && <div><p className="text-sm text-muted-foreground">IFSC</p><p className="font-mono text-sm">{customer.bank_ifsc}</p></div>}
              </CardContent>
            </Card>
          )}

          {customer.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{customer.notes}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Commercial Terms</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <Badge variant="outline">Net {customer.payment_terms ?? 30}</Badge>
              </div>
              {customer.credit_limit != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credit Limit</span>
                  <span className="font-medium">₹{customer.credit_limit.toLocaleString("en-IN")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

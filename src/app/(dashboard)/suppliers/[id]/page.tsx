import { notFound } from "next/navigation"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { getSupplier } from "@/actions/suppliers"
import { DeleteContactButton } from "@/components/contacts/delete-contact-button"

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let supplier
  try {
    supplier = await getSupplier(id)
  } catch {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={supplier.company ?? undefined}
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: supplier.name }]}
      >
        <Link href={`/suppliers/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
        <DeleteContactButton id={id} mode="supplier" name={supplier.name} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {supplier.email && <div><p className="text-sm text-muted-foreground">Email</p><p>{supplier.email}</p></div>}
                {supplier.phone && <div><p className="text-sm text-muted-foreground">Phone</p><p>{supplier.phone}</p></div>}
                {supplier.gstin && <div><p className="text-sm text-muted-foreground">GSTIN</p><p className="font-mono text-sm">{supplier.gstin}</p></div>}
              </div>
              {(supplier.address || supplier.city || supplier.state) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p>{[supplier.address, supplier.city, supplier.state].filter(Boolean).join(", ")}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(supplier.bank_name || supplier.bank_account || supplier.bank_ifsc) && (
            <Card>
              <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                {supplier.bank_name && <div><p className="text-sm text-muted-foreground">Bank</p><p>{supplier.bank_name}</p></div>}
                {supplier.bank_account && <div><p className="text-sm text-muted-foreground">Account</p><p className="font-mono text-sm">{supplier.bank_account}</p></div>}
                {supplier.bank_ifsc && <div><p className="text-sm text-muted-foreground">IFSC</p><p className="font-mono text-sm">{supplier.bank_ifsc}</p></div>}
              </CardContent>
            </Card>
          )}

          {supplier.notes && (
            <Card>
              <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">{supplier.notes}</p></CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <Badge variant="outline">Net {supplier.payment_terms ?? 30}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

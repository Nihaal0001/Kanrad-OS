import Link from "next/link"
import { Plus } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCustomers } from "@/actions/customers"
import { Users } from "lucide-react"

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const customers = await getCustomers({ search })

  return (
    <>
      <PageHeader
        title="Customers"
        description="Sales contacts for brands, businesses, and garment clients"
        breadcrumbs={[{ label: "Customers" }]}
      >
        <Link href="/customers/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Customer
          </Button>
        </Link>
      </PageHeader>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add your brands, businesses, and garment clients here"
          action={{ label: "Add Customer", href: "/customers/new" }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Credit Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{c.gstin ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell>
                      {c.payment_terms != null ? (
                        <Badge variant="outline">Net {c.payment_terms}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.credit_limit != null
                        ? `₹${c.credit_limit.toLocaleString("en-IN")}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  )
}

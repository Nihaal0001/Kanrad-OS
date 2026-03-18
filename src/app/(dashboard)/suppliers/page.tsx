import Link from "next/link"
import { Plus, Truck } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getSuppliers } from "@/actions/suppliers"

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const suppliers = await getSuppliers({ search })

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Purchase contacts — fabric vendors, trims suppliers, service providers"
        breadcrumbs={[{ label: "Suppliers" }]}
      >
        <Link href="/suppliers/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Supplier
          </Button>
        </Link>
      </PageHeader>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Add your fabric vendors, trims suppliers, and service providers"
          action={<Link href="/suppliers/new"><Button>Add Supplier</Button></Link>}
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
                  <TableHead>Email</TableHead>
                  <TableHead>Payment Terms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                        {s.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.company ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{s.gstin ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.email ?? "—"}</TableCell>
                    <TableCell>
                      {s.payment_terms != null ? (
                        <Badge variant="outline">Net {s.payment_terms}</Badge>
                      ) : "—"}
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

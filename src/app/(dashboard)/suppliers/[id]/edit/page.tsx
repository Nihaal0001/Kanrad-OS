import { notFound } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { ContactForm } from "@/components/contacts/contact-form"
import { getSupplier } from "@/actions/suppliers"

export default async function EditSupplierPage({
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
        title="Edit Supplier"
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: supplier.name, href: `/suppliers/${id}` }, { label: "Edit" }]}
      />
      <div className="max-w-2xl">
        <ContactForm mode="supplier" record={supplier} />
      </div>
    </>
  )
}

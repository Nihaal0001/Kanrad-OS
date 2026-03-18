import { notFound } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { ContactForm } from "@/components/contacts/contact-form"
import { getCustomer } from "@/actions/customers"

export default async function EditCustomerPage({
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
        title="Edit Customer"
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: customer.name, href: `/customers/${id}` }, { label: "Edit" }]}
      />
      <div className="max-w-2xl">
        <ContactForm mode="customer" record={customer} />
      </div>
    </>
  )
}

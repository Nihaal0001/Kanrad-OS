import { PageHeader } from "@/components/shared/page-header"
import { ContactForm } from "@/components/contacts/contact-form"

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader
        title="New Customer"
        breadcrumbs={[{ label: "Customers", href: "/customers" }, { label: "New" }]}
      />
      <div className="max-w-2xl">
        <ContactForm mode="customer" />
      </div>
    </>
  )
}

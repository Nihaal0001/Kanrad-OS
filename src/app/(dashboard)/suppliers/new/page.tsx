import { PageHeader } from "@/components/shared/page-header"
import { ContactForm } from "@/components/contacts/contact-form"

export default function NewSupplierPage() {
  return (
    <>
      <PageHeader
        title="New Supplier"
        breadcrumbs={[{ label: "Suppliers", href: "/suppliers" }, { label: "New" }]}
      />
      <div className="max-w-2xl">
        <ContactForm mode="supplier" />
      </div>
    </>
  )
}

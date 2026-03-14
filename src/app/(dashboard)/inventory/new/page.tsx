import { getCategories } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { MaterialForm } from "@/components/inventory/material-form"

export default async function NewMaterialPage() {
  const categories = await getCategories()

  return (
    <>
      <PageHeader
        title="Add Material"
        description="Add a new material to your inventory"
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Add Material" },
        ]}
      />
      <MaterialForm categories={categories} />
    </>
  )
}

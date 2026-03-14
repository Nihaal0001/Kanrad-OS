import { notFound } from "next/navigation"

import { getMaterial, getCategories } from "@/actions/inventory"
import { PageHeader } from "@/components/shared/page-header"
import { MaterialForm } from "@/components/inventory/material-form"

interface EditMaterialPageProps {
  params: Promise<{ id: string }>
}

export default async function EditMaterialPage({ params }: EditMaterialPageProps) {
  const { id } = await params

  let material
  try {
    material = await getMaterial(id)
  } catch {
    notFound()
  }

  const categories = await getCategories()

  return (
    <>
      <PageHeader
        title="Edit Material"
        description={`Editing ${material.name}`}
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: material.name, href: `/inventory/${material.id}` },
          { label: "Edit" },
        ]}
      />
      <MaterialForm material={material} categories={categories} />
    </>
  )
}

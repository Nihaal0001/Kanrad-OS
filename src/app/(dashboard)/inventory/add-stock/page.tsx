import { getCategories, getMaterials } from "@/actions/inventory"
import { getSuppliers } from "@/actions/suppliers"
import { getCurrentProfile } from "@/lib/auth-context"
import { circleWeightFor, isCircleMaterial, type CircleCostable } from "@/lib/costing"
import { PageHeader } from "@/components/shared/page-header"
import { AddStockForm } from "@/components/inventory/add-stock-form"

export default async function AddStockPage() {
  const { profile } = await getCurrentProfile()
  const header = (
    <PageHeader
      title="Add Stock"
      description="Add stock to inventory and book the supplier bill in Finance"
      breadcrumbs={[{ label: "Inventory", href: "/inventory" }, { label: "Add Stock" }]}
    />
  )

  if (profile?.role !== "admin") {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground">Only an admin can add stock directly.</p>
      </>
    )
  }

  const [materials, categories, suppliers] = await Promise.all([getMaterials(), getCategories(), getSuppliers()])

  return (
    <>
      {header}
      <AddStockForm
        materials={materials.map((m) => ({
          id: m.id as string,
          sku: m.sku as string,
          name: m.name as string,
          unit: m.unit as string,
          currentStock: Number(m.current_stock) || 0,
          cost: Number(m.cost_per_unit) || 0,
          supplierName: (m.supplier_name as string | null) ?? "",
          circleType: (m.circle_type as "ib" | "non_ib" | null) ?? null,
          isCircle: isCircleMaterial(m as CircleCostable),
          pieceWeightKg: isCircleMaterial(m as CircleCostable) ? circleWeightFor(m as CircleCostable) : null,
        }))}
        categories={categories.map((c) => ({ id: c.id as string, name: c.name as string }))}
        suppliers={suppliers.map((s) => ({ id: s.id as string, name: (s.company || s.name) as string, gstin: (s.gstin as string | null) ?? "", state: (s.state as string | null) ?? "" }))}
      />
    </>
  )
}

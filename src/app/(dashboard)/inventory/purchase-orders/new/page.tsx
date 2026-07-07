import { getMaterials } from "@/actions/inventory"
import { getOrders } from "@/actions/orders"
import { PageHeader } from "@/components/shared/page-header"
import { PurchaseOrderForm } from "@/components/inventory/purchase-order-form"

export default async function NewPurchaseOrderPage() {
  const [materials, orders] = await Promise.all([
    getMaterials(),
    getOrders(),
  ])
  const activeOrders = orders.filter((o) => o.status === "confirmed" || o.status === "in_production")

  return (
    <>
      <PageHeader
        title="New Purchase Order"
        description="Create a material purchase order for a supplier"
        breadcrumbs={[
          { label: "Inventory", href: "/inventory" },
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: "New" },
        ]}
      />
      <PurchaseOrderForm
        materials={materials.map((m) => ({
          id: m.id,
          name: m.name,
          sku: m.sku,
          unit: m.unit,
          cost_per_unit: m.cost_per_unit,
          category_id: m.category_id ?? null,
          category_name: (m.category as { id: string; name: string } | null)?.name ?? null,
        }))}
        orders={activeOrders.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          product_variant: o.product_variant,
        }))}
      />
    </>
  )
}

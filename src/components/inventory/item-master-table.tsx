"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Search, Pencil, Trash2, AlertTriangle, IndianRupee, Lock, Download, RefreshCw } from "lucide-react"

import type { MaterialWithCategory } from "@/lib/supabase/types"
import { friendlyError } from "@/lib/utils"
import { deleteMaterial, applyCirclePricing } from "@/actions/inventory"
import { downloadExcel } from "@/lib/export"
import { CIRCLE_WEIGHT_FACTOR } from "@/lib/circle-calc"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ItemMasterTableProps {
  materials: MaterialWithCategory[]
  categories: Array<{ id: string; name: string }>
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ItemMasterTable({ materials, categories }: ItemMasterTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [aluPrice, setAluPrice] = useState<string>("")
  const [isPending, startTransition] = useTransition()

  const filteredMaterials = useMemo(() => {
    let result = materials

    if (categoryFilter !== "all") {
      result = result.filter((m) => m.category_id === categoryFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.supplier_name?.toLowerCase().includes(q)
      )
    }

    return result
  }, [materials, categoryFilter, search])

  const unpricedCount = useMemo(
    () => materials.filter((m) => !m.cost_per_unit || m.cost_per_unit === 0).length,
    [materials]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      const result = await deleteMaterial(id)
      setDeletingId(null)
      setConfirmId(null)

      if ("error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }

      toast.success("Material deactivated")
      router.refresh()
    },
    [router]
  )

  const aluPriceNum = parseFloat(aluPrice) || 0

  function parseNameDimensions(name: string): { dia: number; thick: number } | null {
    // Format: "Alu Circle 263 x 2.9" — also handles "263*2.9", "263*2.9(126)"
    const nameMatch = name.match(/(\d+(?:\.\d+)?)\s*[x*]\s*(\d+(?:\.\d+)?)/i)
    if (nameMatch) {
      const dia = parseFloat(nameMatch[1])
      const thick = parseFloat(nameMatch[2])
      if (dia > 0 && thick > 0) return { dia, thick }
    }
    return null
  }

  function calcCircleCost(material: MaterialWithCategory): { cost: number; dia: number; thick: number } | null {
    if (aluPriceNum <= 0) return null
    let dia = material.diameter_mm
    let thick = material.thickness_mm
    if (!dia || !thick) {
      const parsed = parseNameDimensions(material.name)
      if (!parsed) return null
      dia = parsed.dia
      thick = parsed.thick
    }
    const cost = Math.round(dia * dia * thick * CIRCLE_WEIGHT_FACTOR * aluPriceNum * 100) / 100
    return { cost, dia, thick }
  }

  function handleApplyCirclePricing() {
    if (aluPriceNum <= 0) {
      toast.error("Enter a valid aluminium price per kg first")
      return
    }
    startTransition(async () => {
      const result = await applyCirclePricing(aluPriceNum)
      if ("error" in result && result.error) {
        toast.error(result.error)
      } else if ("success" in result) {
        const msg = (result.skipped ?? 0) > 0
          ? `Updated ${result.updated} circles. ${result.skipped} skipped (name format not recognised).`
          : `Updated cost for ${result.updated} circle material${result.updated !== 1 ? "s" : ""}`
        toast.success(msg)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Aluminium Circle Pricing */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Aluminium Circle Price
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px] max-w-xs space-y-1">
            <label className="text-xs text-muted-foreground">Price per kg (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 388"
                value={aluPrice}
                onChange={(e) => setAluPrice(e.target.value)}
                className="pl-6"
              />
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5 pb-1">
            <p className="font-medium">Formula: dia × dia × thickness × 0.000002127 × price</p>
            {aluPriceNum > 0 && (
              <p className="text-foreground">
                e.g. 263×2.9mm → 263²×2.9×0.000002127×{aluPriceNum} = <span className="font-semibold">
                  ₹{(263 * 263 * 2.9 * CIRCLE_WEIGHT_FACTOR * aluPriceNum).toFixed(2)}/pc
                </span>
              </p>
            )}
            <p className="text-muted-foreground/70">Reads dia & thickness from name — format: "Alu Circle 263 x 2.9"</p>
          </div>
          <Button
            size="sm"
            disabled={aluPriceNum <= 0 || isPending}
            onClick={handleApplyCirclePricing}
            className="shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Updating…" : "Apply to All Circles"}
          </Button>
        </div>
      </div>

      {/* Unpriced warning */}
      {unpricedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-amber-700">
            <strong>{unpricedCount} material{unpricedCount > 1 ? "s" : ""}</strong> have no cost set — BOM costing will be incomplete.
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU or supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filteredMaterials.length} material{filteredMaterials.length !== 1 ? "s" : ""}
          </p>
          <Button size="sm" variant="outline" onClick={() => downloadExcel(
            filteredMaterials.map(m => ({
              sku: m.sku,
              name: m.name,
              category: m.category?.name ?? "",
              unit: m.unit,
              current_stock: m.current_stock,
              min_stock_level: m.min_stock_level ?? "",
              cost_per_unit: m.cost_per_unit ?? "",
              supplier: m.supplier_name ?? "",
              notes: m.notes ?? "",
              is_active: m.is_active ? "Yes" : "No",
            })),
            [
              { key: "sku", label: "SKU" },
              { key: "name", label: "Name" },
              { key: "category", label: "Category" },
              { key: "unit", label: "Unit" },
              { key: "current_stock", label: "Current Stock" },
              { key: "min_stock_level", label: "Min Stock Level" },
              { key: "cost_per_unit", label: "Cost Per Unit (₹)" },
              { key: "supplier", label: "Supplier" },
              { key: "notes", label: "Notes" },
              { key: "is_active", label: "Active" },
            ],
            `item-master-${new Date().toISOString().split("T")[0]}.xlsx`,
            "Item Master"
          )}>
            <Download className="h-4 w-4 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1">
        <Button
          variant={categoryFilter === "all" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setCategoryFilter("all")}
          className="h-8 text-xs"
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCategoryFilter(cat.id)}
            className="h-8 text-xs"
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Table */}
      {filteredMaterials.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">No materials found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    Max Purchase Price
                  </span>
                </TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-[50px]">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMaterials.map((material) => (
                <TableRow key={material.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/inventory/${material.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {material.sku}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/inventory/${material.id}`} className="hover:underline">
                      {material.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {material.category?.name ? (
                      <Badge variant="outline">{material.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{material.unit}</TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const isCircle = material.circle_type != null
                      const calc = isCircle ? calcCircleCost(material) : null
                      if (calc !== null) {
                        return (
                          <div className="text-right">
                            <span className="tabular-nums font-semibold">
                              ₹{formatCurrency(calc.cost)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {calc.dia}×{calc.thick}mm · preview
                            </span>
                          </div>
                        )
                      }
                      if (material.cost_per_unit > 0) {
                        return (
                          <span className="tabular-nums font-semibold">
                            ₹{formatCurrency(material.cost_per_unit)}
                          </span>
                        )
                      }
                      return (
                        <Link
                          href={`/inventory/${material.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline"
                        >
                          <IndianRupee className="h-3 w-3" />
                          Set price
                        </Link>
                      )
                    })()}
                  </TableCell>
                  <TableCell>
                    {material.supplier_name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={deletingId === material.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/inventory/${material.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setConfirmId(material.id)}
                          disabled={deletingId === material.id}
                        >
                          <Trash2 className="h-4 w-4" />
                          Deactivate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => { if (!open) setConfirmId(null) }}
        title="Deactivate Material"
        description="This material will be hidden from active lists but not permanently deleted. Continue?"
        confirmLabel="Deactivate"
        onConfirm={() => confirmId && handleDelete(confirmId)}
        loading={deletingId !== null}
      />
    </div>
  )
}

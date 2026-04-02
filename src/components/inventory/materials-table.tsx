"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Search, Eye, Pencil, Trash2, AlertTriangle } from "lucide-react"

import type { MaterialWithCategory } from "@/lib/supabase/types"
import { cn, friendlyError } from "@/lib/utils"
import { calculateCircleWeight, kgToPieces } from "@/lib/circle-calc"
import { deleteMaterial } from "@/actions/inventory"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { StockLevelBar } from "@/components/inventory/stock-level-bar"

interface MaterialsTableProps {
  materials: MaterialWithCategory[]
  categories: Array<{ id: string; name: string }>
}

export function MaterialsTable({ materials, categories }: MaterialsTableProps) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [showLowStock, setShowLowStock] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const filteredMaterials = useMemo(() => {
    let result = materials

    if (categoryFilter !== "all") {
      result = result.filter((m) => m.category_id === categoryFilter)
    }

    if (showLowStock) {
      result = result.filter(
        (m) => m.current_stock <= m.min_stock_level && m.min_stock_level > 0
      )
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

    return [...result].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: "base" }))
  }, [materials, categoryFilter, showLowStock, search])

  const lowStockCount = useMemo(
    () =>
      materials.filter(
        (m) => m.current_stock <= m.min_stock_level && m.min_stock_level > 0
      ).length,
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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {filteredMaterials.length} material{filteredMaterials.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        <Button
          variant={categoryFilter === "all" && !showLowStock ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            setCategoryFilter("all")
            setShowLowStock(false)
          }}
          className="h-8 text-xs"
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={categoryFilter === cat.id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setCategoryFilter(cat.id)
              setShowLowStock(false)
            }}
            className={cn(
              "h-8 text-xs",
              categoryFilter === cat.id && "font-semibold"
            )}
          >
            {cat.name}
          </Button>
        ))}
        {lowStockCount > 0 && (
          <Button
            variant={showLowStock ? "destructive" : "ghost"}
            size="sm"
            onClick={() => {
              setShowLowStock(!showLowStock)
              setCategoryFilter("all")
            }}
            className="h-8 text-xs"
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Low Stock ({lowStockCount})
          </Button>
        )}
      </div>

      {/* Table */}
      {filteredMaterials.length === 0 ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border">
          <p className="text-sm text-muted-foreground">
            No materials found matching your criteria.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock Level</TableHead>
                <TableHead className="text-right">Stock (kg)</TableHead>
                <TableHead className="text-right">Stock (pcs)</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead>Unit</TableHead>
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
                    {material.category?.name ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StockLevelBar
                      current={material.current_stock}
                      minimum={material.min_stock_level}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {material.current_stock.toLocaleString("en-IN")}
                    {material.circle_type === "non_ib" && material.diameter_mm && material.thickness_mm && (() => {
                      const wpp = calculateCircleWeight(material.diameter_mm, material.thickness_mm, "non_ib")
                      return wpp ? <span className="block text-xs font-normal text-muted-foreground">{wpp.toFixed(4)} kg/pc</span> : null
                    })()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {material.circle_type === "non_ib" && material.diameter_mm && material.thickness_mm
                      ? (() => {
                          const pcs = kgToPieces(material.current_stock, material.diameter_mm, material.thickness_mm, "non_ib")
                          return pcs ? pcs.toLocaleString("en-IN") : "—"
                        })()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {material.min_stock_level > 0
                      ? material.min_stock_level.toLocaleString("en-IN")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {material.unit}
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
                          <Link href={`/inventory/${material.id}`}>
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
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

"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Calculator,
  Package,
  Pencil,
  Plus,
  IndianRupee,
  TrendingUp,
  History,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CIRCLE_WEIGHT_FACTOR } from "@/lib/circle-calc"

const ALU_CIRCLE_RE = /^alu\s*circle/i

function parseCircleDims(name: string): { dia: number; thick: number } | null {
  const m = name.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/)
  if (!m) return null
  const dia = parseFloat(m[1]), thick = parseFloat(m[2])
  return dia > 0 && thick > 0 ? { dia, thick } : null
}

interface MaterialLine {
  id: string
  material_id: string
  qty_required: number
  unit: string
  wastage_pct: number
  material: {
    id: string
    name: string
    sku: string
    cost_per_unit: number
    unit: string
    current_stock: number
  } | null
}

interface Product {
  id: string
  product_sku: string
  product_name: string
  category: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bom_items: any[]
  materialCost: number
}

interface Props {
  products: Product[]
  initialProductId?: string
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ProductCostingCalculator({ products, initialProductId }: Props) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(initialProductId ?? "")
  const [quantity, setQuantity] = useState(100)
  const [laborCost, setLaborCost] = useState(0)
  const [overheadCost, setOverheadCost] = useState(0)
  const [otherCost, setOtherCost] = useState(0)
  const [marginPct, setMarginPct] = useState(20)
  const [pricingMode, setPricingMode] = useState<"actual" | "market">("actual")
  const [marketAluPrice, setMarketAluPrice] = useState("")

  const marketAluPriceNum = parseFloat(marketAluPrice) || 0

  const product = products.find((p) => p.id === selectedId) ?? null

  const bomLines: (MaterialLine & { effectiveQty: number; lineCost: number; hasPrice: boolean; isCircle: boolean; marketCost: number | null })[] =
    useMemo(() => {
      if (!product) return []
      return product.bom_items.map((item) => {
        const mat = Array.isArray(item.material) ? item.material[0] ?? null : item.material
        const effectiveQty = item.qty_required * (1 + (item.wastage_pct ?? 0) / 100)
        const isCircle = mat ? ALU_CIRCLE_RE.test(mat.name) : false

        // Market cost: only for circles, only when price is entered
        let marketCost: number | null = null
        if (isCircle && mat && marketAluPriceNum > 0) {
          const dims = parseCircleDims(mat.name)
          if (dims) {
            const costPerPc = dims.dia * dims.dia * dims.thick * CIRCLE_WEIGHT_FACTOR * marketAluPriceNum
            marketCost = effectiveQty * costPerPc
          }
        }

        const unitPrice = pricingMode === "market" && marketCost !== null
          ? null // use marketCost directly
          : mat?.cost_per_unit ?? 0

        const hasPrice = pricingMode === "market" && isCircle
          ? marketAluPriceNum > 0 && marketCost !== null
          : !!(mat && mat.cost_per_unit > 0)

        const lineCost = pricingMode === "market" && marketCost !== null
          ? marketCost
          : (mat && mat.cost_per_unit > 0 ? effectiveQty * mat.cost_per_unit : 0)

        return { ...item, material: mat, effectiveQty, lineCost, hasPrice, isCircle, marketCost }
      })
    }, [product, pricingMode, marketAluPriceNum])

  const unpriced = bomLines.filter((l) => !l.hasPrice)
  const materialCostPerUnit = bomLines.reduce((s, l) => s + l.lineCost, 0)
  const totalMaterialCost = materialCostPerUnit * quantity
  const totalLaborCost = laborCost * quantity
  const totalOverheadCost = overheadCost * quantity
  const totalOtherCost = otherCost * quantity
  const totalCost = totalMaterialCost + totalLaborCost + totalOverheadCost + totalOtherCost
  const costPerUnit = quantity > 0 ? totalCost / quantity : 0
  const sellingPrice = costPerUnit * (1 + marginPct / 100)

  function handleProductChange(id: string) {
    setSelectedId(id)
    router.replace(`/products/costing?product=${id}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      {/* Product Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select Product (BOM)</CardTitle>
          <CardDescription>
            Choose a product to calculate its cost. Material prices come from Master Inventory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedId} onValueChange={handleProductChange}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="Select a product…" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-medium">{p.product_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{p.product_sku}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {products.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Package className="h-5 w-5 shrink-0" />
              <span>No products yet. Create a product with a BOM first.</span>
              <Button asChild size="sm" className="ml-auto shrink-0">
                <Link href="/products/new">
                  <Plus className="h-4 w-4" />
                  New Product
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {product && (
        <>
          {/* Unpriced warning */}
          {unpriced.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-amber-700">
                  {unpriced.length} material{unpriced.length > 1 ? "s" : ""} missing price
                </p>
                <p className="text-amber-600/80">
                  Set <code className="text-xs bg-amber-500/20 px-1 rounded">cost_per_unit</code> in{" "}
                  <Link href="/inventory" className="underline underline-offset-2">Master Inventory</Link> for:
                  {" "}{unpriced.map((l) => l.material?.name ?? "Unknown").join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Pricing Mode Toggle */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium mr-1">Circle Pricing:</span>
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setPricingMode("actual")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${pricingMode === "actual" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <History className="h-3.5 w-3.5" />
                Actual Purchase Price
              </button>
              <button
                type="button"
                onClick={() => setPricingMode("market")}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${pricingMode === "market" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Current Market Rate
              </button>
            </div>
            {pricingMode === "market" && (
              <div className="flex items-center gap-2 ml-1">
                <span className="text-xs text-muted-foreground">Alu price:</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="388"
                    value={marketAluPrice}
                    onChange={(e) => setMarketAluPrice(e.target.value)}
                    className="pl-6 h-8 text-sm"
                  />
                </div>
                <span className="text-xs text-muted-foreground">/kg</span>
              </div>
            )}
            {pricingMode === "actual" && (
              <span className="text-xs text-muted-foreground">Using FIFO weighted-average cost from purchase receipts</span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">

              {/* Material Costs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Material Costs — {product.product_name}
                    </CardTitle>
                    <CardDescription>
                      {pricingMode === "actual" ? "From BOM × actual purchase prices (FIFO)" : "From BOM × current market rate for circles"}
                    </CardDescription>
                  </div>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/products/${product.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit BOM
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {bomLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center justify-between px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{line.material?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.qty_required} {line.unit}
                            {line.wastage_pct > 0 && (
                              <span className="ml-1 text-muted-foreground/60">
                                +{line.wastage_pct}% wastage → {line.effectiveQty.toFixed(3)} {line.unit}
                              </span>
                            )}
                            {" × "}
                            {(() => {
                              if (pricingMode === "market" && line.isCircle) {
                                if (marketAluPriceNum > 0 && line.marketCost !== null) {
                                  const dims = parseCircleDims(line.material?.name ?? "")
                                  const cppc = dims ? dims.dia * dims.dia * dims.thick * CIRCLE_WEIGHT_FACTOR * marketAluPriceNum : 0
                                  return <span className="text-blue-600 font-medium">₹{formatCurrency(cppc)}/pc <span className="font-normal text-muted-foreground">(market)</span></span>
                                }
                                return <span className="text-amber-500 font-medium">Enter alu price</span>
                              }
                              return line.hasPrice
                                ? <span>₹{formatCurrency(line.material!.cost_per_unit)}</span>
                                : <span className="text-amber-500 font-medium">No price</span>
                            })()}
                          </p>
                        </div>
                        <p className="text-sm font-semibold tabular-nums shrink-0 ml-4">
                          {line.hasPrice ? (
                            `₹${formatCurrency(line.lineCost)}`
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </p>
                      </div>
                    ))}

                    <div className="flex items-center justify-between px-5 py-3 bg-muted/30 font-semibold">
                      <span className="text-sm">Material Cost / Unit</span>
                      <span className="tabular-nums">₹{formatCurrency(materialCostPerUnit)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Costs */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Costs (per unit)</CardTitle>
                  <CardDescription>Labor, overhead, and other charges per unit produced</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Labor Cost / Unit (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={laborCost || ""}
                        onChange={(e) => setLaborCost(Number(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Overhead / Unit (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={overheadCost || ""}
                        onChange={(e) => setOverheadCost(Number(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Other / Unit (₹)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={otherCost || ""}
                        onChange={(e) => setOtherCost(Number(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel */}
            <div className="space-y-6">

              {/* Quantity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Batch Quantity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    <Label>Units to Produce</Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                      className="h-11 text-lg font-semibold"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Cost Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Cost Summary
                  </CardTitle>
                  <CardDescription>For {quantity.toLocaleString("en-IN")} units</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materials</span>
                    <span className="tabular-nums">₹{formatCurrency(totalMaterialCost)}</span>
                  </div>
                  {laborCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Labor</span>
                      <span className="tabular-nums">₹{formatCurrency(totalLaborCost)}</span>
                    </div>
                  )}
                  {overheadCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overhead</span>
                      <span className="tabular-nums">₹{formatCurrency(totalOverheadCost)}</span>
                    </div>
                  )}
                  {otherCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Other</span>
                      <span className="tabular-nums">₹{formatCurrency(totalOtherCost)}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between font-semibold">
                    <span>Total Cost</span>
                    <span className="tabular-nums">₹{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>Cost / Unit</span>
                    <span className="tabular-nums">₹{formatCurrency(costPerUnit)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Selling Price Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Selling Price
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Target Margin (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="1"
                      value={marginPct}
                      onChange={(e) => setMarginPct(Number(e.target.value) || 0)}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost / Unit</span>
                      <span className="tabular-nums">₹{formatCurrency(costPerUnit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Margin ({marginPct}%)</span>
                      <span className="tabular-nums text-emerald-600">
                        +₹{formatCurrency(sellingPrice - costPerUnit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-1">
                      <span>Selling Price</span>
                      <span className="tabular-nums">₹{formatCurrency(sellingPrice)}</span>
                    </div>
                  </div>

                  {/* Badge breakdown */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-xs">
                      Material: {materialCostPerUnit > 0 ? Math.round((materialCostPerUnit / costPerUnit) * 100) : 0}%
                    </Badge>
                    {laborCost > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Labor: {Math.round((laborCost / costPerUnit) * 100)}%
                      </Badge>
                    )}
                    {overheadCost > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Overhead: {Math.round((overheadCost / costPerUnit) * 100)}%
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

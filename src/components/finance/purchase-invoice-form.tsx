"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, X } from "lucide-react"

import { toast } from "sonner"
import {
  purchaseInvoiceSchema,
  type PurchaseInvoiceFormData,
} from "@/lib/validators/purchase-invoices"
import { createPurchaseInvoice } from "@/actions/purchase-invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
  "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

const GSTIN_STATE: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh",
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface PurchaseOrderOption {
  id: string
  po_number: string
  supplier_name: string
  total_amount: number
}

interface PurchaseInvoiceFormProps {
  purchaseOrders: PurchaseOrderOption[]
  orgGstin?: string
}

export function PurchaseInvoiceForm({ purchaseOrders, orgGstin }: PurchaseInvoiceFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PurchaseInvoiceFormData>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      purchase_order_id: "",
      supplier_name: "",
      supplier_gst: "",
      invoice_number: "",
      tax_rate: 18,
      place_of_supply: "",
      is_igst: false,
      invoice_date: today,
      due_date: "",
      notes: "",
      items: [{ description: "", quantity: 1, unit_price: 0, hsn_code: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  const items = watch("items")
  const taxRate = watch("tax_rate")
  const isIgst = watch("is_igst")
  const poId = watch("purchase_order_id")
  const supplierGst = watch("supplier_gst")

  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0)
  const taxAmount = subtotal * (taxRate || 0) / 100
  const total = subtotal + taxAmount

  // Auto-detect IGST from GSTINs
  function handleSupplierGstChange(gst: string) {
    setValue("supplier_gst", gst)
    if (gst.length >= 2 && orgGstin && orgGstin.length >= 2) {
      const supplierState = GSTIN_STATE[gst.substring(0, 2)]
      const orgState = GSTIN_STATE[orgGstin.substring(0, 2)]
      if (supplierState && orgState) {
        const inter = supplierState !== orgState
        setValue("is_igst", inter)
        setValue("place_of_supply", supplierState)
      }
    }
  }

  // Auto-fill from PO
  function handlePoSelect(id: string) {
    setValue("purchase_order_id", id === "none" ? "" : id)
    if (id !== "none") {
      const po = purchaseOrders.find((p) => p.id === id)
      if (po) {
        setValue("supplier_name", po.supplier_name)
      }
    }
  }

  async function onSubmit(data: PurchaseInvoiceFormData) {
    setLoading(true)
    setError(null)
    const result = await createPurchaseInvoice(data)
    setLoading(false)

    if ("error" in result && result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success("Purchase invoice created")
    router.push("/finance/purchases")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* PO Selection + Supplier Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Link to Purchase Order</Label>
            <Select value={poId || "none"} onValueChange={handlePoSelect}>
              <SelectTrigger>
                <SelectValue placeholder="No PO" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No PO</SelectItem>
                {purchaseOrders.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    {po.po_number} — {po.supplier_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier_name">Supplier Name *</Label>
            <Input id="supplier_name" {...register("supplier_name")} />
            {errors.supplier_name && (
              <p className="text-xs text-destructive">{errors.supplier_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supplier_gst">Supplier GSTIN</Label>
            <Input
              id="supplier_gst"
              {...register("supplier_gst")}
              onChange={(e) => handleSupplierGstChange(e.target.value)}
              placeholder="e.g. 27AABCU9603R1ZM"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invoice_number">Supplier Invoice No.</Label>
            <Input
              id="invoice_number"
              {...register("invoice_number")}
              placeholder="Supplier's invoice/bill number"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="invoice_date">Invoice Date *</Label>
            <Controller
              control={control}
              name="invoice_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.invoice_date && (
              <p className="text-xs text-destructive">{errors.invoice_date.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="due_date">Due Date</Label>
            <Controller
              control={control}
              name="due_date"
              render={({ field }) => (
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tax_rate">GST Rate (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              {...register("tax_rate", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Place of Supply</Label>
            <Select
              value={watch("place_of_supply") || "none"}
              onValueChange={(v) => setValue("place_of_supply", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="is_igst"
              checked={isIgst}
              onChange={(e) => setValue("is_igst", e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="is_igst" className="font-normal">
              Interstate supply (IGST)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit_price: 0, hsn_code: "" })}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] items-start gap-2">
              <div>
                <Input
                  {...register(`items.${index}.description`)}
                  placeholder="Description"
                />
                {errors.items?.[index]?.description && (
                  <p className="text-xs text-destructive mt-0.5">{errors.items[index].description?.message}</p>
                )}
              </div>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                placeholder="Qty"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                placeholder="Price"
              />
              <Input
                {...register(`items.${index}.hsn_code`)}
                placeholder="HSN"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Totals */}
          <div className="border-t pt-3 space-y-1 text-sm text-right">
            <p>Subtotal: ₹{formatCurrency(subtotal)}</p>
            {isIgst ? (
              <p>IGST ({taxRate}%): ₹{formatCurrency(taxAmount)}</p>
            ) : (
              <>
                <p>CGST ({taxRate / 2}%): ₹{formatCurrency(taxAmount / 2)}</p>
                <p>SGST ({taxRate / 2}%): ₹{formatCurrency(taxAmount / 2)}</p>
              </>
            )}
            <p className="text-base font-semibold">Total: ₹{formatCurrency(total)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={2} placeholder="Optional notes" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Purchase Invoice
        </Button>
      </div>
    </form>
  )
}

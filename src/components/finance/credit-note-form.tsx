"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import { creditNoteSchema, type CreditNoteFormData } from "@/lib/validators/credit-notes"
import { createCreditNote } from "@/actions/credit-notes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Invoice {
  id: string
  invoice_number: string
  buyer_name: string
  total_amount: number
}

interface Props {
  invoices: Invoice[]
  prefillInvoiceId?: string
}

export function CreditNoteForm({ invoices, prefillInvoiceId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const prefillInvoice = invoices.find((i) => i.id === prefillInvoiceId)

  const form = useForm<CreditNoteFormData>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: {
      invoice_id: prefillInvoiceId ?? "",
      buyer_name: prefillInvoice?.buyer_name ?? "",
      issue_date: new Date().toISOString().slice(0, 10),
      tax_rate: 18,
      items: [{ description: "", quantity: 1, unit_price: 0, amount: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchedItems = form.watch("items")
  const watchedTaxRate = form.watch("tax_rate") || 0

  const subtotal = watchedItems.reduce((s, i) => {
    const qty = Number(i.quantity) || 0
    const price = Number(i.unit_price) || 0
    return s + qty * price
  }, 0)
  const taxAmount = Math.round(subtotal * (watchedTaxRate / 100) * 100) / 100
  const total = subtotal + taxAmount

  function handleInvoiceChange(invoiceId: string) {
    const inv = invoices.find((i) => i.id === invoiceId)
    if (inv) {
      form.setValue("invoice_id", invoiceId)
      form.setValue("buyer_name", inv.buyer_name)
    }
  }

  function updateAmount(index: number) {
    const qty = Number(form.getValues(`items.${index}.quantity`)) || 0
    const price = Number(form.getValues(`items.${index}.unit_price`)) || 0
    form.setValue(`items.${index}.amount`, Math.round(qty * price * 100) / 100)
  }

  function onSubmit(data: CreditNoteFormData) {
    startTransition(async () => {
      const result = await createCreditNote(data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success("Credit note created")
        router.push("/finance/credit-notes")
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Link to Invoice */}
        <div className="space-y-1.5">
          <Label className="text-sm">Linked Invoice (optional)</Label>
          <Select
            value={form.watch("invoice_id") || "none"}
            onValueChange={(v) => v === "none" ? form.setValue("invoice_id", "") : handleInvoiceChange(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select invoice..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {invoices.map((inv) => (
                <SelectItem key={inv.id} value={inv.id}>
                  {inv.invoice_number} · {inv.buyer_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Issue Date */}
        <div className="space-y-1.5">
          <Label className="text-sm">Issue Date *</Label>
          <Input type="date" {...form.register("issue_date")} />
          {form.formState.errors.issue_date && (
            <p className="text-xs text-destructive">{form.formState.errors.issue_date.message}</p>
          )}
        </div>

        {/* Buyer Name */}
        <div className="space-y-1.5">
          <Label className="text-sm">Buyer Name *</Label>
          <Input placeholder="Buyer name" {...form.register("buyer_name")} />
          {form.formState.errors.buyer_name && (
            <p className="text-xs text-destructive">{form.formState.errors.buyer_name.message}</p>
          )}
        </div>

        {/* Buyer GST */}
        <div className="space-y-1.5">
          <Label className="text-sm">Buyer GSTIN</Label>
          <Input placeholder="22AAAAA0000A1Z5" className="font-mono" {...form.register("buyer_gst")} />
        </div>

        {/* Reason */}
        <div className="col-span-2 space-y-1.5">
          <Label className="text-sm">Reason for Credit Note</Label>
          <Input placeholder="e.g. Buyer returned 50 defective pieces from order JC-240115-001" {...form.register("reason")} />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-semibold">Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit_price: 0, amount: 0 })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Item
          </Button>
        </div>

        <div className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 mb-1">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-[1fr_80px_110px_100px_40px] gap-2 items-center">
              <Input
                placeholder="Description"
                {...form.register(`items.${index}.description`)}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                className="text-right"
                placeholder="1"
                {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                onChange={(e) => {
                  form.setValue(`items.${index}.quantity`, parseFloat(e.target.value) || 0)
                  updateAmount(index)
                }}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                className="text-right"
                placeholder="0.00"
                {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                onChange={(e) => {
                  form.setValue(`items.${index}.unit_price`, parseFloat(e.target.value) || 0)
                  updateAmount(index)
                }}
              />
              <p className="text-right text-sm font-medium pr-2">
                ₹{(watchedItems[index]?.amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Tax %</span>
            <Input
              type="number"
              min={0}
              max={100}
              className="h-7 w-20 text-right text-sm"
              {...form.register("tax_rate", { valueAsNumber: true })}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax Amount</span>
            <span>₹{taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>Credit Total</span>
            <span className="text-[hsl(16,65%,55%)]">₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-sm">Notes</Label>
        <textarea
          className="flex min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Additional notes..."
          {...form.register("notes")}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create Credit Note"}
        </Button>
      </div>
    </form>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { customerSchema, supplierSchema, type CustomerFormData, type SupplierFormData } from "@/lib/validators/contacts"
import { createCustomer, updateCustomer } from "@/actions/customers"
import { createSupplier, updateSupplier } from "@/actions/suppliers"
import type { Customer, Supplier } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

type Mode = "customer" | "supplier"

interface ContactFormProps {
  mode: Mode
  record?: Customer | Supplier
}

export function ContactForm({ mode, record }: ContactFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!record
  const backPath = mode === "customer" ? "/customers" : "/suppliers"

  const schema = mode === "customer" ? customerSchema : supplierSchema
  const form = useForm<CustomerFormData | SupplierFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: record?.name ?? "",
      company: record?.company ?? "",
      email: record?.email ?? "",
      phone: record?.phone ?? "",
      address: record?.address ?? "",
      city: record?.city ?? "",
      state: record?.state ?? "",
      gstin: record?.gstin ?? "",
      bank_name: record?.bank_name ?? "",
      bank_account: record?.bank_account ?? "",
      bank_ifsc: record?.bank_ifsc ?? "",
      payment_terms: record?.payment_terms ?? 30,
      notes: record?.notes ?? "",
      ...(mode === "customer" ? {
        credit_limit: (record as Customer)?.credit_limit ?? undefined,
      } : {}),
    },
  })

  async function onSubmit(data: CustomerFormData | SupplierFormData) {
    setIsSubmitting(true)
    try {
      let result
      if (mode === "customer") {
        result = isEditing
          ? await updateCustomer(record!.id, data as CustomerFormData)
          : await createCustomer(data as CustomerFormData)
      } else {
        result = isEditing
          ? await updateSupplier(record!.id, data as SupplierFormData)
          : await createSupplier(data as SupplierFormData)
      }

      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(isEditing ? `${mode === "customer" ? "Customer" : "Supplier"} updated` : `${mode === "customer" ? "Customer" : "Supplier"} created`)
      router.push(backPath)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="Contact name" {...form.register("name")} />
              {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input placeholder="Company / Business name" {...form.register("company")} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@example.com" {...form.register("email")} />
              {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+91 98765 43210" {...form.register("phone")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input placeholder="Street address" {...form.register("address")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>City</Label>
              <Input placeholder="City" {...form.register("city")} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input placeholder="State" {...form.register("state")} />
            </div>
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input placeholder="27AABCU9603R1ZM" {...form.register("gstin")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bank Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input placeholder="e.g., HDFC Bank" {...form.register("bank_name")} />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input placeholder="Account number" {...form.register("bank_account")} />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input placeholder="HDFC0001234" {...form.register("bank_ifsc")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Commercial Terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input type="number" min={0} placeholder="30" {...form.register("payment_terms", { valueAsNumber: true })} />
            </div>
            {mode === "customer" && (
              <div className="space-y-2">
                <Label>Credit Limit (₹)</Label>
                <Input type="number" min={0} placeholder="100000" {...form.register("credit_limit", { valueAsNumber: true })} />
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Notes</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Internal notes..."
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.push(backPath)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? `Update ${mode === "customer" ? "Customer" : "Supplier"}` : `Create ${mode === "customer" ? "Customer" : "Supplier"}`}
        </Button>
      </div>
    </form>
  )
}

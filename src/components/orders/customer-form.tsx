"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { toast } from "sonner"
import { createCustomer, updateCustomer } from "@/actions/customers"
import { customerSchema, type CustomerFormData } from "@/lib/validators/contacts"
import { numberOrUndefined } from "@/lib/utils"
import type { Customer } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CustomerFormProps {
  customer?: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (customer?: Customer) => void
}

export function CustomerForm({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: CustomerFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!customer

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? "",
      company: customer?.company ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      address: customer?.address ?? "",
      gstin: customer?.gstin ?? "",
      notes: customer?.notes ?? "",
      credit_limit: customer?.credit_limit ?? undefined,
      payment_terms: customer?.payment_terms ?? undefined,
    },
  })

  async function onSubmit(data: CustomerFormData) {
    setError(null)

    const result = isEditing
      ? await updateCustomer(customer.id, data)
      : await createCustomer(data)

    if ("error" in result && result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success(isEditing ? "Customer updated" : "Customer added")
    reset()
    onOpenChange(false)
    router.refresh()

    if (onSuccess) {
      const newCustomer = "data" in result ? (result.data as Customer) : undefined
      onSuccess(newCustomer)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null)
      reset()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the customer details below."
              : "Fill in the details to add a new customer."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="name" placeholder="Customer name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="Company name" {...register("company")} />
              {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="customer@example.com" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+91 98765 43210" {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" placeholder="Full address" {...register("address")} />
            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gstin">GST Number</Label>
              <Input id="gstin" placeholder="22AAAAA0000A1Z5" {...register("gstin")} />
              {errors.gstin && <p className="text-xs text-destructive">{errors.gstin.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms (days)</Label>
              <Input id="payment_terms" type="number" min={0} placeholder="30" {...register("payment_terms", { setValueAs: numberOrUndefined })} />
              {errors.payment_terms && <p className="text-xs text-destructive">{errors.payment_terms.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="credit_limit">Credit Limit</Label>
              <Input id="credit_limit" type="number" step="0.01" placeholder="0.00" {...register("credit_limit", { setValueAs: numberOrUndefined })} />
              {errors.credit_limit && <p className="text-xs text-destructive">{errors.credit_limit.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" placeholder="Additional notes" {...register("notes")} />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEditing ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

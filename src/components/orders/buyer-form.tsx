"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { toast } from "sonner"
import { buyerSchema, type BuyerFormData } from "@/lib/validators/buyer"
import { createBuyer, updateBuyer } from "@/actions/buyers"
import type { Buyer } from "@/lib/supabase/types"
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

interface BuyerFormProps {
  buyer?: Buyer
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (buyer?: Buyer) => void
}

export function BuyerForm({
  buyer,
  open,
  onOpenChange,
  onSuccess,
}: BuyerFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!buyer

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      name: buyer?.name ?? "",
      company: buyer?.company ?? "",
      email: buyer?.email ?? "",
      phone: buyer?.phone ?? "",
      address: buyer?.address ?? "",
      gst_number: buyer?.gst_number ?? "",
      notes: buyer?.notes ?? "",
    },
  })

  async function onSubmit(data: BuyerFormData) {
    setError(null)

    const result = isEditing
      ? await updateBuyer(buyer.id, data)
      : await createBuyer(data)

    if ("error" in result && result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success(isEditing ? "Buyer updated" : "Buyer added")
    reset()
    onOpenChange(false)
    router.refresh()

    if (onSuccess) {
      const newBuyer = "data" in result ? (result.data as Buyer) : undefined
      onSuccess(newBuyer)
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
          <DialogTitle>
            {isEditing ? "Edit Buyer" : "Add New Buyer"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the buyer details below."
              : "Fill in the details to add a new buyer."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name / Company row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Buyer name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Company name"
                {...register("company")}
              />
              {errors.company && (
                <p className="text-xs text-destructive">
                  {errors.company.message}
                </p>
              )}
            </div>
          </div>

          {/* Email / Phone row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="buyer@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">
                  {errors.phone.message}
                </p>
              )}
            </div>
          </div>

          {/* Address - full width */}
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              placeholder="Full address"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>

          {/* GST Number - full width */}
          <div className="space-y-2">
            <Label htmlFor="gst_number">GST Number</Label>
            <Input
              id="gst_number"
              placeholder="22AAAAA0000A1Z5"
              {...register("gst_number")}
            />
            {errors.gst_number && (
              <p className="text-xs text-destructive">
                {errors.gst_number.message}
              </p>
            )}
          </div>

          {/* Notes - full width */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              placeholder="Additional notes"
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Update Buyer" : "Add Buyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

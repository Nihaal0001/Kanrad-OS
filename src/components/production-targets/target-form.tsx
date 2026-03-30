"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { productionTargetSchema, createProductionTarget, type ProductionTargetFormData } from "@/actions/production-targets"
import { friendlyError } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function TargetForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<ProductionTargetFormData>({
    resolver: zodResolver(productionTargetSchema),
    defaultValues: {
      product_name: "",
      daily_target_qty: 0,
      target_date: new Date().toISOString().split("T")[0],
    },
  })

  async function onSubmit(data: ProductionTargetFormData) {
    const result = await createProductionTarget(data)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Target created")
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Set Target
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Daily Production Target</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="product_name">Product Name *</Label>
            <Input id="product_name" {...form.register("product_name")} placeholder="e.g., Steel Pressure Cooker 3L" />
            {form.formState.errors.product_name && (
              <p className="text-xs text-destructive">{form.formState.errors.product_name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="daily_target_qty">Target Quantity *</Label>
              <Input
                id="daily_target_qty"
                type="number"
                min={1}
                step="1"
                {...form.register("daily_target_qty", { valueAsNumber: true })}
              />
              {form.formState.errors.daily_target_qty && (
                <p className="text-xs text-destructive">{form.formState.errors.daily_target_qty.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">Target Date *</Label>
              <Input id="target_date" type="date" {...form.register("target_date")} />
              {form.formState.errors.target_date && (
                <p className="text-xs text-destructive">{form.formState.errors.target_date.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Create Target"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

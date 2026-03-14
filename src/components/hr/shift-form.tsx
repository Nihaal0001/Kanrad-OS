"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Pencil } from "lucide-react"

import { shiftSchema, type ShiftFormData } from "@/lib/validators/hr"
import { createShift, updateShift } from "@/actions/hr"
import type { Shift } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface ShiftFormProps {
  existing?: Shift
  trigger?: React.ReactNode
}

export function ShiftForm({ existing, trigger }: ShiftFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ShiftFormData>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      name: existing?.name ?? "",
      start_time: existing?.start_time ?? "08:00",
      end_time: existing?.end_time ?? "17:00",
      description: existing?.description ?? "",
    },
  })

  async function onSubmit(data: ShiftFormData) {
    setLoading(true)
    setError(null)
    const result = existing
      ? await updateShift(existing.id, data)
      : await createShift(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={existing ? "outline" : "default"}>
            {existing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {existing ? "Edit" : "New Shift"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Shift" : "New Shift"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="name">Shift Name *</Label>
            <Input id="name" {...register("name")} placeholder="Morning, Night, General…" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_time">Start Time *</Label>
              <Input id="start_time" type="time" {...register("start_time")} />
              {errors.start_time && (
                <p className="text-xs text-destructive">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_time">End Time *</Label>
              <Input id="end_time" type="time" {...register("end_time")} />
              {errors.end_time && (
                <p className="text-xs text-destructive">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              rows={2}
              placeholder="Optional notes about this shift"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {existing ? "Update" : "Create Shift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

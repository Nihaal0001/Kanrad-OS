"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { toast } from "sonner"
import { expenseSchema, type ExpenseFormData } from "@/lib/validators/expenses"
import { createExpense, updateExpense } from "@/actions/expenses"
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
import { ExpenseCategoryDialog } from "./expense-category-dialog"

interface ExpenseFormProps {
  categories: { id: string; name: string }[]
  orders: { id: string; order_number: string; style_name: string }[]
  editId?: string
  defaultValues?: Partial<ExpenseFormData>
}

export function ExpenseForm({ categories, orders, editId, defaultValues }: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catList, setCatList] = useState(categories)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category_id: defaultValues?.category_id ?? "",
      order_id: defaultValues?.order_id ?? "",
      amount: defaultValues?.amount ?? undefined,
      expense_date: defaultValues?.expense_date ?? today,
      description: defaultValues?.description ?? "",
      notes: defaultValues?.notes ?? "",
    },
  })

  const categoryId = watch("category_id")
  const orderId = watch("order_id")

  async function onSubmit(data: ExpenseFormData) {
    setLoading(true)
    setError(null)

    const result = editId
      ? await updateExpense(editId, data)
      : await createExpense(data)

    setLoading(false)

    if ("error" in result && result.error) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    toast.success(editId ? "Expense updated" : "Expense recorded")
    router.push("/finance/expenses")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editId ? "Edit Expense" : "Record Expense"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <div className="flex gap-2">
                <Select
                  value={categoryId}
                  onValueChange={(v) => setValue("category_id", v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {catList.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ExpenseCategoryDialog
                  onCreated={(id, name) => {
                    setCatList((prev) => [...prev, { id, name }].sort((a, b) => a.name.localeCompare(b.name)))
                    setValue("category_id", id)
                  }}
                />
              </div>
              {errors.category_id && (
                <p className="text-xs text-destructive">{errors.category_id.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense_date">Date *</Label>
              <Controller
                control={control}
                name="expense_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.expense_date && (
                <p className="text-xs text-destructive">{errors.expense_date.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Order (optional)</Label>
              <Select
                value={orderId || "none"}
                onValueChange={(v) => setValue("order_id", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No order</SelectItem>
                  {orders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.order_number} — {order.style_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tag this expense to a specific order for cost tracking
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Brief description of the expense"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              rows={2}
              placeholder="Additional notes (optional)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? "Update Expense" : "Save Expense"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

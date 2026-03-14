import { z } from "zod"

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(2000).optional().or(z.literal("")),
  order_id: z.string().optional().or(z.literal("")),
  stage_id: z.string().optional().or(z.literal("")),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]),
  due_date: z.string().optional().or(z.literal("")),
})

export type TaskFormData = z.infer<typeof taskSchema>

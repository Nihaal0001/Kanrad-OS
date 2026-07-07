import { z } from "zod"

export const exitItemSchema = z.object({
  exit_date: z.string().min(1, "Exit date is required"),
})

export type ExitItemFormData = z.infer<typeof exitItemSchema>

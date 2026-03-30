import { z } from "zod"

export const issueSchema = z.object({
  module: z.string().min(1, "Module is required"),
  issue_type: z.string().min(1, "Issue type is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  severity: z.enum(["medium", "high", "critical"]),
})

export type IssueFormData = z.infer<typeof issueSchema>

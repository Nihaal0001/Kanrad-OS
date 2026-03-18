import { z } from "zod"

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  gstin: z.string().max(20).optional().or(z.literal("")),
  bank_name: z.string().max(200).optional().or(z.literal("")),
  bank_account: z.string().max(50).optional().or(z.literal("")),
  bank_ifsc: z.string().max(20).optional().or(z.literal("")),
  credit_limit: z.number().min(0).optional(),
  payment_terms: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type CustomerFormData = z.infer<typeof customerSchema>

export const supplierSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  gstin: z.string().max(20).optional().or(z.literal("")),
  bank_name: z.string().max(200).optional().or(z.literal("")),
  bank_account: z.string().max(50).optional().or(z.literal("")),
  bank_ifsc: z.string().max(20).optional().or(z.literal("")),
  payment_terms: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
})

export type SupplierFormData = z.infer<typeof supplierSchema>

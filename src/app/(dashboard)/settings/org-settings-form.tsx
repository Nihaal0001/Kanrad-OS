"use client"

import { useTransition, useRef } from "react"
import { toast } from "sonner"
import { saveOrgSettings } from "./actions"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface OrgSettingsFormProps {
  defaults: {
    org_name: string
    org_type: string
    gstin: string
    address: string
    city: string
    state: string
    pincode: string
    phone: string
    email: string
  }
}

export function OrgSettingsForm({ defaults }: OrgSettingsFormProps) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveOrgSettings(formData)
      if (result?.error) {
        toast.error("Failed to save: " + result.error)
      } else {
        toast.success("Organisation settings saved")
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org_name">Organisation Name</Label>
          <Input id="org_name" name="org_name" defaultValue={defaults.org_name} placeholder="Your company name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org_type">Business Type</Label>
          <Input id="org_type" name="org_type" defaultValue={defaults.org_type} placeholder="e.g., Garment Manufacturing" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="gstin">GSTIN</Label>
        <Input id="gstin" name="gstin" defaultValue={defaults.gstin} placeholder="22AAAAA0000A1Z5" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={defaults.address} placeholder="Street address" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={defaults.city} placeholder="City" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" name="state" defaultValue={defaults.state} placeholder="State" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pincode">Pincode</Label>
          <Input id="pincode" name="pincode" defaultValue={defaults.pincode} placeholder="000000" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={defaults.phone} placeholder="+91 98765 43210" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email} placeholder="info@yourcompany.com" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending} className="max-sm:w-full">
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  )
}

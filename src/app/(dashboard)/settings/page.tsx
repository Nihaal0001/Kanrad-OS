import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

// These are static for now — will move to DB/env after Phase 8 (Auth)
const ORG_INFO = {
  name: "JUST CLOTHING",
  type: "Garment Manufacturing Unit",
  gstin: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  email: "",
}

const MODULES = [
  { name: "Orders & Buyers", status: "active" },
  { name: "Inventory", status: "active" },
  { name: "Production Tracking", status: "active" },
  { name: "Quality Control", status: "active" },
  { name: "Tasks", status: "active" },
  { name: "Notifications", status: "active" },
  { name: "Finance", status: "active" },
  { name: "HR & Payroll", status: "active" },
  { name: "Authentication & Roles", status: "planned" },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Organisation information and system configuration"
      />

      <div className="max-w-2xl space-y-8">
        {/* Organisation Info */}
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>
              Basic details about your manufacturing unit. These will be used on invoices and reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="org_name">Organisation Name</Label>
                <Input
                  id="org_name"
                  defaultValue={ORG_INFO.name}
                  placeholder="Your company name"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="org_type">Business Type</Label>
                <Input
                  id="org_type"
                  defaultValue={ORG_INFO.type}
                  placeholder="e.g., Garment Manufacturing"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN</Label>
              <Input
                id="gstin"
                defaultValue={ORG_INFO.gstin}
                placeholder="22AAAAA0000A1Z5"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                defaultValue={ORG_INFO.address}
                placeholder="Street address"
                disabled
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" defaultValue={ORG_INFO.city} placeholder="City" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" defaultValue={ORG_INFO.state} placeholder="State" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" defaultValue={ORG_INFO.pincode} placeholder="000000" disabled />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" defaultValue={ORG_INFO.phone} placeholder="+91 98765 43210" disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue={ORG_INFO.email} placeholder="info@yourcompany.com" disabled />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Editing will be enabled after authentication is set up (Phase 8).
            </p>
          </CardContent>
        </Card>

        {/* Supabase Project */}
        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
            <CardDescription>Supabase project connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">Project Ref</span>
              <code className="font-mono text-xs">spwighzxkaeibutmijus</code>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">Migrations Applied</span>
              <span className="font-medium">00001 — 00006</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">RLS</span>
              <Badge variant="outline" className="text-amber-600 border-amber-600/30">
                Permissive (Phase 8)
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <CardTitle>Modules</CardTitle>
            <CardDescription>Active modules in this ERP installation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {MODULES.map((mod, i) => (
                <div key={mod.name}>
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <span className={mod.status === "planned" ? "text-muted-foreground" : ""}>{mod.name}</span>
                    <Badge
                      variant="outline"
                      className={
                        mod.status === "active"
                          ? "text-emerald-600 border-emerald-600/30"
                          : "text-muted-foreground"
                      }
                    >
                      {mod.status === "active" ? "Active" : "Planned"}
                    </Badge>
                  </div>
                  {i < MODULES.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

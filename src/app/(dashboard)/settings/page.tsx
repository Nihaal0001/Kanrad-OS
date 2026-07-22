import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { OrgSettingsForm } from "./org-settings-form"
import { KioskSettingsForm } from "./kiosk-settings-form"
import { getOrgSettings, getOfficeLocation } from "./actions"
import { ExportAllButton } from "@/components/settings/export-all-button"

const MODULES = [
  { name: "Orders & Customers", status: "active" },
  { name: "Customers & Suppliers Directory", status: "active" },
  { name: "Inventory", status: "active" },
  { name: "Production Tracking + Wastage", status: "active" },
  { name: "Quality Control", status: "active" },
  { name: "Tasks", status: "active" },
  { name: "Notifications", status: "active" },
  { name: "Finance — Invoices, Payments, Costing", status: "active" },
  { name: "Credit Notes & Returns", status: "active" },
  { name: "Bank Reconciliation", status: "active" },
  { name: "Tally XML Export", status: "active" },
  { name: "E-Invoice JSON (GST IRP)", status: "active" },
  { name: "Customer Portal (share link)", status: "active" },
  { name: "HR & Payroll", status: "active" },
  { name: "Email Alerts (Resend)", status: "active" },
  { name: "WhatsApp Digest (Twilio)", status: "active" },
  { name: "Authentication & Roles", status: "active" },
  { name: "AI Assistant (Gemini + Sarvam)", status: "active" },
  { name: "QR Attendance Kiosk", status: "active" },
  { name: "Accounting — Journal, Ledger, Trial Balance", status: "active" },
  { name: "Audit Trail", status: "active" },
]

export default async function SettingsPage() {
  const [saved, officeLoc] = await Promise.all([
    getOrgSettings(),
    getOfficeLocation(),
  ])

  const defaults = {
    org_name: saved?.org_name ?? "KANRAD ERP",
    org_type: saved?.org_type ?? "Houseware Manufacturing Unit",
    gstin: saved?.gstin ?? "",
    address: saved?.address ?? "",
    city: saved?.city ?? "",
    state: saved?.state ?? "",
    pincode: saved?.pincode ?? "",
    phone: saved?.phone ?? "",
    email: saved?.email ?? "",
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Organisation information and system configuration"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <div className="max-w-2xl space-y-6 sm:space-y-8">
        {/* Organisation Info */}
        <Card>
          <CardHeader>
            <CardTitle>Organisation</CardTitle>
            <CardDescription>
              Basic details about your manufacturing unit — used on invoices and reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrgSettingsForm defaults={defaults} />
          </CardContent>
        </Card>

        {/* Kiosk & Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Kiosk & Attendance</CardTitle>
            <CardDescription>
              Office GPS coordinates for geofenced QR attendance. Workers scanning outside this radius will be flagged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KioskSettingsForm defaults={officeLoc} />
          </CardContent>
        </Card>

        {/* Supabase Project */}
        <Card>
          <CardHeader>
            <CardTitle>Database</CardTitle>
          <CardDescription>Supabase project connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm max-sm:flex-col max-sm:items-start max-sm:gap-1">
              <span className="text-muted-foreground">Project Ref</span>
              <code className="font-mono text-xs max-sm:break-all">bdskmkfubdmmzvntzzgu</code>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm max-sm:flex-col max-sm:items-start max-sm:gap-1">
              <span className="text-muted-foreground">Migrations Applied</span>
              <span className="font-medium">00001 — 00025</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm max-sm:flex-col max-sm:items-start max-sm:gap-2">
              <span className="text-muted-foreground">RLS</span>
              <Badge variant="outline" className="border-emerald-600/30 text-emerald-600">
                Authenticated users only
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Data Export */}
        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>
              Export all your ERP data as a multi-sheet Excel file — orders, invoices, materials, HR, audit log, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportAllButton />
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
                  <div className="flex items-center justify-between py-2.5 text-sm max-sm:flex-col max-sm:items-start max-sm:gap-2">
                    <span className="pr-2">{mod.name}</span>
                    <Badge variant="outline" className="border-emerald-600/30 text-emerald-600">
                      Active
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

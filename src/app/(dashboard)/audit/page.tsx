import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { AuditLogTable } from "@/components/audit/audit-log-table"
import { getAuditLogs } from "@/actions/audit"
import { AuditFilters } from "./audit-filters"

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; action?: string; from?: string; to?: string }>
}) {
  const params = await searchParams
  const logs = await getAuditLogs({
    entityType: params.entityType,
    action: params.action,
    from: params.from,
    to: params.to,
    limit: 500,
  })

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Full history of every create, update, delete, and status change across all modules"
        breadcrumbs={[{ label: "Audit Log" }]}
      />

      <div className="space-y-4">
        <AuditFilters />

        <Card>
          <CardContent className="p-0">
            <AuditLogTable logs={logs} />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-right">
          Showing up to 500 most recent entries
        </p>
      </div>
    </>
  )
}

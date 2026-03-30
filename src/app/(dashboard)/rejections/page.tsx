import { XCircle, PackageX, Undo2, Trash2 } from "lucide-react"

import { getRejections, getRejectionSummary } from "@/actions/rejections"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { RejectionsTable } from "@/components/rejections/rejections-table"
import { RejectionForm } from "@/components/rejections/rejection-form"

export default async function RejectionsPage() {
  const [rejections, summary] = await Promise.all([
    getRejections(),
    getRejectionSummary(),
  ])

  return (
    <>
      <PageHeader
        title="Rejections"
        description="Track rejected items across production, warehouse, logistics and client stages"
        breadcrumbs={[{ label: "Rejections" }]}
      >
        <RejectionForm />
      </PageHeader>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Rejected"
          value={summary.totalRejected.toLocaleString("en-IN")}
          description="Cumulative rejected quantity"
          icon={PackageX}
        />
        <StatCard
          title="Returned / Recovered"
          value={summary.totalReturned.toLocaleString("en-IN")}
          description="Returned to usable or saleable"
          icon={Undo2}
        />
        <StatCard
          title="Total Loss"
          value={summary.totalLoss.toLocaleString("en-IN")}
          description="Written off as loss or non-saleable"
          icon={Trash2}
        />
      </div>

      {rejections.length === 0 ? (
        <EmptyState
          icon={XCircle}
          title="No rejections recorded"
          description="Record a rejection whenever items are rejected at any production stage."
        />
      ) : (
        <RejectionsTable rejections={rejections} />
      )}
    </>
  )
}

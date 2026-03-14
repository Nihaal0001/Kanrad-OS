import Link from "next/link"
import { CheckCircle } from "lucide-react"

import { getQualityChecks } from "@/actions/production"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { QualityChecksTable } from "@/components/production/quality-checks-table"

export default async function QualityPage() {
  const checks = await getQualityChecks()

  return (
    <>
      <PageHeader
        title="Quality"
        description="Quality check reports and defect tracking across all orders"
      />

      {checks.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No QC reports yet"
          description="Open a production order and submit a quality check to get started."
          action={{ label: "View Production", href: "/production" }}
        />
      ) : (
        <QualityChecksTable checks={checks} />
      )}
    </>
  )
}

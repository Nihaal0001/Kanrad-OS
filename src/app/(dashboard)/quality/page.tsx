import { CheckCircle } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function QualityPage() {
  return (
    <>
      <PageHeader
        title="Quality"
        description="Quality check reports and defect tracking"
      />
      <EmptyState
        icon={CheckCircle}
        title="No QC reports"
        description="Submit a quality check report to get started"
      />
    </>
  )
}

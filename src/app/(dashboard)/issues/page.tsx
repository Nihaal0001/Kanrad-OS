import { AlertTriangle } from "lucide-react"

import { getIssues } from "@/actions/issues"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { IssuesTable } from "@/components/issues/issues-table"
import { IssueForm } from "@/components/issues/issue-form"

export default async function IssuesPage() {
  const issues = await getIssues()

  return (
    <>
      <PageHeader
        title="Issues"
        description="Track and resolve system and operational issues across all modules"
        breadcrumbs={[{ label: "Issues" }]}
      >
        <IssueForm />
      </PageHeader>

      {issues.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No issues reported"
          description="Report an issue whenever you encounter a system or operational problem."
        />
      ) : (
        <IssuesTable issues={issues} />
      )}
    </>
  )
}

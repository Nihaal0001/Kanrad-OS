import { Target } from "lucide-react"

import { getProductionTargets } from "@/actions/production-targets"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { TargetsTable } from "@/components/production-targets/targets-table"
import { TargetForm } from "@/components/production-targets/target-form"

export default async function ProductionTargetsPage() {
  const targets = await getProductionTargets()

  return (
    <>
      <PageHeader
        title="Production Targets"
        description="Set daily production targets and record actuals to track performance"
        breadcrumbs={[
          { label: "Production", href: "/production" },
          { label: "Targets" },
        ]}
      >
        <TargetForm />
      </PageHeader>

      {targets.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No production targets set"
          description="Set daily targets for each product to start tracking production performance."
        />
      ) : (
        <TargetsTable targets={targets} />
      )}
    </>
  )
}

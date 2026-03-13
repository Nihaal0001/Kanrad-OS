import { RefreshCcw } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function ShiftsPage() {
  return (
    <>
      <PageHeader
        title="Shifts"
        description="Define and assign worker shifts"
      />
      <EmptyState
        icon={RefreshCcw}
        title="No shifts defined"
        description="Create shifts to organize your workforce"
      />
    </>
  )
}

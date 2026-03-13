import { Settings } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="System configuration and preferences"
      />
      <EmptyState
        icon={Settings}
        title="Settings"
        description="Configuration options coming soon"
      />
    </>
  )
}

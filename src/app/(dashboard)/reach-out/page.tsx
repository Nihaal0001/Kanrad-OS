import { Send } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { ReachOutForm } from "@/components/reach-out/reach-out-form"

export default function ReachOutPage() {
  return (
    <>
      <PageHeader
        title="Reach Out"
        description="Submit a support ticket — questions, issues, or feedback go directly to the admin."
      />
      <ReachOutForm />
    </>
  )
}

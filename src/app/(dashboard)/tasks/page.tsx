import { ListTodo } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Assign and track tasks across departments"
      />
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Create your first task"
      />
    </>
  )
}

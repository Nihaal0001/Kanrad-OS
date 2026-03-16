import { ListTodo } from "lucide-react"

import { getTasks } from "@/actions/tasks"
import { PageHeader } from "@/components/shared/page-header"
import { TaskBoard } from "@/components/tasks/task-board"
import { TaskForm } from "@/components/tasks/task-form"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function TasksPage() {
  const tasks = await getTasks()

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Assign and track tasks across departments"
        breadcrumbs={[{ label: "Tasks" }]}
      >
        <TaskForm
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              New Task
            </Button>
          }
        />
      </PageHeader>

      <TaskBoard tasks={tasks} />
    </>
  )
}

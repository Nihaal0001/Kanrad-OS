"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CheckCircle, Send } from "lucide-react"

import { submitReachOut } from "@/actions/reach-out"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
  phone: z.string().max(20).optional().or(z.literal("")),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
  priority: z.enum(["medium", "high", "critical"]),
})

type FormData = z.infer<typeof schema>

export function ReachOutForm() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: "",
      priority: "medium",
    },
  })

  async function onSubmit(data: FormData) {
    setServerError(null)
    const result = await submitReachOut(data)
    if ("error" in result && result.error) {
      setServerError(result.error)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Ticket submitted</h2>
            <p className="text-sm text-muted-foreground">
              Your message has been sent to the admin. We&apos;ll get back to you shortly.
            </p>
          </div>
          <Button variant="outline" onClick={() => { setSubmitted(false); form.reset() }}>
            Send another message
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Submit a Support Ticket
        </CardTitle>
        <CardDescription>
          Reach out to the admin with questions, issues, or feedback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input {...form.register("name")} placeholder="Your full name" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input {...form.register("email")} type="email" placeholder="you@example.com" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...form.register("phone")} placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-1.5">
              <Label>Priority *</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(v) => form.setValue("priority", v as FormData["priority"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                      Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                      High
                    </span>
                  </SelectItem>
                  <SelectItem value="critical">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                      Critical
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input {...form.register("subject")} placeholder="Brief description of the issue" />
            {form.formState.errors.subject && (
              <p className="text-xs text-destructive">{form.formState.errors.subject.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea
              {...form.register("message")}
              placeholder="Describe your issue or request in detail..."
              rows={5}
              className="resize-none"
            />
            {form.formState.errors.message && (
              <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-destructive">{serverError}</p>
          )}

          <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            {form.formState.isSubmitting ? "Sending…" : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

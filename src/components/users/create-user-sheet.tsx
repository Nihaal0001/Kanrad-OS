"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { createUser } from "@/actions/users"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { PermissionPicker } from "@/components/users/permission-picker"

export function CreateUserSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [departments, setDepartments] = useState<string[]>([])

  function handleOpen() {
    setName("")
    setEmail("")
    setPassword("")
    setPhone("")
    setIsAdmin(false)
    setDepartments([])
    setOpen(true)
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (!email.trim()) { toast.error("Email is required"); return }
    if (!password || password.length < 6) { toast.error("Password must be at least 6 characters"); return }
    if (!isAdmin && departments.length === 0) { toast.error("Select at least one department"); return }

    startTransition(async () => {
      const result = await createUser({
        full_name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        is_admin: isAdmin,
        departments,
      })
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${name} added successfully`)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        Add User
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[95vh] flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b text-center">
            <SheetTitle className="text-center text-lg">Create New User</SheetTitle>
            <SheetDescription className="sr-only">Create a new team member account</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Name + Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-semibold">Name *</Label>
                <Input
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">Email *</Label>
                <Input
                  type="email"
                  placeholder="john@factory.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* Password + Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-semibold">Password *</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">WhatsApp Number</Label>
                <Input
                  type="tel"
                  placeholder="+919876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>

            {/* User Role */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
              <Label className="text-purple-400 font-semibold text-sm">User Role *</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Regular User */}
                <button
                  type="button"
                  onClick={() => setIsAdmin(false)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
                    !isAdmin
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      !isAdmin ? "border-blue-500" : "border-muted-foreground"
                    )}>
                      {!isAdmin && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <span className="font-semibold text-sm">Regular User</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    Limited access based on departments
                  </p>
                </button>

                {/* Admin */}
                <button
                  type="button"
                  onClick={() => setIsAdmin(true)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-all",
                    isAdmin
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-border bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                      isAdmin ? "border-blue-500" : "border-muted-foreground"
                    )}>
                      {isAdmin && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                    <span className="font-semibold text-sm">Admin</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">Full system access</p>
                </button>
              </div>
            </div>

            {/* Access — only for regular users */}
            {!isAdmin && (
              <div className="space-y-3">
                <Label className="font-semibold text-sm">
                  Select Pages <span className="text-muted-foreground font-normal">(What can they access?)</span>
                </Label>
                <PermissionPicker selected={departments} onChange={setDepartments} />
              </div>
            )}
          </div>

          <div className="px-6 pb-8 pt-4 border-t">
            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "Creating…" : "Create User"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

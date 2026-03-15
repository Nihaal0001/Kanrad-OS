import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="font-serif text-7xl font-bold text-muted-foreground/20">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}

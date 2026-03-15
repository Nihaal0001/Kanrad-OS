import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Attendance Kiosk",
}

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-foreground text-background flex items-center justify-center">
      {children}
    </div>
  )
}

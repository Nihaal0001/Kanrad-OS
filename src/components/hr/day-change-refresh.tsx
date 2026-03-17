"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

export function DayChangeRefresh() {
  const router = useRouter()
  const mountedDate = useRef(new Date().toISOString().split("T")[0])

  useEffect(() => {
    function checkDate() {
      const today = new Date().toISOString().split("T")[0]
      if (today !== mountedDate.current) {
        mountedDate.current = today
        router.refresh()
      }
    }

    const interval = setInterval(checkDate, 60_000)

    function handleVisibility() {
      if (document.visibilityState === "visible") checkDate()
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [router])

  return null
}

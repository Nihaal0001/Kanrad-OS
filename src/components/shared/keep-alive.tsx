"use client"

import { useEffect } from "react"

// Pings the server every 4 minutes while the user is active to prevent cold starts
export function KeepAlive() {
  useEffect(() => {
    const ping = () => fetch("/api/ping").catch(() => null)
    ping() // immediate ping on mount
    const id = setInterval(ping, 4 * 60 * 1000) // every 4 minutes
    return () => clearInterval(id)
  }, [])

  return null
}

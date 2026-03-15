import { NextResponse } from "next/server"
import { generateToken, WINDOW_MS } from "@/lib/qr-token"

export const dynamic = "force-dynamic"

export async function GET() {
  const token = generateToken()
  const expiresIn = WINDOW_MS - (Date.now() % WINDOW_MS)

  return NextResponse.json({ token, expiresIn })
}

import { createHmac, timingSafeEqual } from "crypto"

const WINDOW_MS = 10_000 // 10 seconds

function windowId(offset = 0): number {
  return Math.floor(Date.now() / WINDOW_MS) + offset
}

function compute(window: number): string {
  return createHmac("sha256", process.env.QR_SECRET!)
    .update(String(window))
    .digest("hex")
    .slice(0, 8)
}

export function generateToken(): string {
  return compute(windowId())
}

export function validateToken(token: string): boolean {
  if (!token || token.length !== 8) return false

  const tokenBuf = Buffer.from(token, "utf8")

  // Accept current window + previous window (20s total tolerance)
  for (const offset of [0, -1]) {
    const expected = Buffer.from(compute(windowId(offset)), "utf8")
    if (tokenBuf.length === expected.length && timingSafeEqual(tokenBuf, expected)) {
      return true
    }
  }

  return false
}

export { WINDOW_MS }

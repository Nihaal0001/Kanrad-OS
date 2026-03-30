import { createHmac } from "crypto"

const secret = () => process.env.PORTAL_SECRET || "kanrad-erp-portal-secret-dev"

export function generatePortalToken(orderId: string): string {
  return createHmac("sha256", secret()).update(orderId).digest("hex").slice(0, 40)
}

export function verifyPortalToken(orderId: string, token: string): boolean {
  if (!token || token.length !== 40) return false
  const expected = generatePortalToken(orderId)
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  }
  return mismatch === 0
}

export function portalUrl(orderId: string): string {
  const token = generatePortalToken(orderId)
  return `/portal/${orderId}/${token}`
}

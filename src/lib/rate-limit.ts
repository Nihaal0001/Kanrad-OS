/**
 * Simple in-memory sliding-window rate limiter.
 *
 * NOTE: This works per-process. On Vercel each serverless function instance
 * has its own memory, so limits are per-instance, not globally enforced.
 * For strict global rate limiting, swap the store for an Upstash Redis client.
 */

interface Entry {
  timestamps: number[]
}

const store = new Map<string, Entry>()

/**
 * Returns true if the request is allowed, false if it should be rejected.
 * @param key        Unique identifier (e.g. user ID + endpoint name)
 * @param maxRequests Maximum requests allowed in the window
 * @param windowMs   Window size in milliseconds
 */
export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key) ?? { timestamps: [] }

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    store.set(key, entry)
    return false
  }

  entry.timestamps.push(now)
  store.set(key, entry)
  return true
}

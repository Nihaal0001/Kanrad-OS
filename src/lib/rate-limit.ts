/**
 * Simple in-memory sliding-window rate limiter.
 *
 * ⚠️  LIMITATION: This works per-process. On Vercel (serverless) each
 * function instance has its own memory, so limits are per-instance and
 * NOT globally enforced across the deployment.
 *
 * TO UPGRADE to globally-enforced rate limiting:
 *   1. Create an Upstash Redis database at https://console.upstash.com
 *   2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env
 *   3. npm install @upstash/redis @upstash/ratelimit
 *   4. Replace this module with:
 *
 *      import { Redis } from "@upstash/redis"
 *      import { Ratelimit } from "@upstash/ratelimit"
 *      const redis = Redis.fromEnv()
 *      const limiters = new Map<string, Ratelimit>()
 *      function getLimiter(max: number, windowMs: number) {
 *        const key = `${max}:${windowMs}`
 *        if (!limiters.has(key)) limiters.set(key,
 *          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(max, `${windowMs / 1000} s`) }))
 *        return limiters.get(key)!
 *      }
 *      export async function rateLimit(key: string, max: number, windowMs: number) {
 *        const { success } = await getLimiter(max, windowMs).limit(key)
 *        return success
 *      }
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

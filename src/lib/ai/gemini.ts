import { GoogleGenerativeAI } from "@google/generative-ai"

let client: GoogleGenerativeAI | null = null

export function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  if (!client) client = new GoogleGenerativeAI(key)
  return client
}

// Retry helper — retries on 503 with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ""
      const is503 = msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("high demand")
      if (is503 && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error("Max retries exceeded")
}

export async function askGemini(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const ai = getGeminiClient()
  if (!ai) throw new Error("Gemini API key not configured")

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: systemPrompt,
  })

  return withRetry(async () => {
    const result = await model.generateContent(userMessage)
    return result.response.text()
  })
}

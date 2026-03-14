import { GoogleGenerativeAI } from "@google/generative-ai"

let client: GoogleGenerativeAI | null = null

export function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  if (!client) client = new GoogleGenerativeAI(key)
  return client
}

export async function askGemini(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const ai = getGeminiClient()
  if (!ai) throw new Error("Gemini API key not configured")

  const model = ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  })

  const result = await model.generateContent(userMessage)
  return result.response.text()
}

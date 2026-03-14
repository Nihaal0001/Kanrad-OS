const SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

interface SarvamMessage {
  role: "system" | "user" | "assistant"
  content: string
}

function getKey() {
  const key = process.env.SARVAM_API_KEY
  if (!key) throw new Error("Sarvam API key not configured")
  return key
}

// ===== Chat (OpenAI-compatible) =====

export async function askSarvam(
  systemPrompt: string,
  messages: SarvamMessage[]
): Promise<string> {
  const key = getKey()

  const response = await fetch(SARVAM_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "sarvam-m",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Sarvam Chat error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  // Log full response in dev to diagnose format issues
  if (process.env.NODE_ENV !== "production") {
    console.log("[Sarvam raw response]", JSON.stringify(data?.choices?.[0], null, 2))
  }

  const raw: string = data.choices?.[0]?.message?.content ?? ""

  if (!raw) return "I couldn't generate a response. Please try again."

  // Strategy: if the response contains </think>, take everything after the LAST one
  const lastCloseIdx = raw.lastIndexOf("</think>")
  if (lastCloseIdx !== -1) {
    return raw.slice(lastCloseIdx + "</think>".length).trim() || "I couldn't generate a response."
  }

  // No closing tag — if it starts with <think>, strip from start up to first double newline
  if (raw.trimStart().toLowerCase().startsWith("<think>")) {
    const doubleNewline = raw.indexOf("\n\n")
    if (doubleNewline !== -1) return raw.slice(doubleNewline).trim()
    // No paragraph break either — just strip the opening tag and return the rest
    return raw.replace(/^<think>/i, "").trim()
  }

  return raw.trim()
}

// ===== Speech-to-Text =====

export interface STTResult {
  transcript: string
  language_code: string | null
}

export async function speechToText(audioBuffer: Buffer, filename: string): Promise<STTResult> {
  const key = getKey()

  const formData = new FormData()
  const arrayBuffer = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer
  formData.append("file", new Blob([arrayBuffer]), filename)
  formData.append("model", "saarika:v2.5")

  const response = await fetch(SARVAM_STT_URL, {
    method: "POST",
    headers: {
      "api-subscription-key": key,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Sarvam STT error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return {
    transcript: data.transcript ?? "",
    language_code: data.language_code ?? null,
  }
}

// ===== Text-to-Speech =====

export interface TTSResult {
  audioBase64: string
}

export async function textToSpeech(
  text: string,
  languageCode: string = "en-IN"
): Promise<TTSResult> {
  const key = getKey()

  const response = await fetch(SARVAM_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": key,
    },
    body: JSON.stringify({
      text: text.slice(0, 2500),
      target_language_code: languageCode,
      speaker: "Shubh",
      model: "bulbul:v3",
      speech_sample_rate: 24000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Sarvam TTS error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return {
    audioBase64: data.audios?.[0] ?? "",
  }
}

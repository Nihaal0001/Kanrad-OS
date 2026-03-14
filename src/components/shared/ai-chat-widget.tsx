"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  MessageSquare,
  X,
  Mic,
  MicOff,
  Send,
  Loader2,
  Bot,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react"

import { askAI, transcribeAudio, synthesizeSpeech, type ChatMessage } from "@/actions/ai"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [detectedLang, setDetectedLang] = useState("en-IN")

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Send text message
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? query).trim()
    if (!msg || loading) return

    const userMsg: ChatMessage = { role: "user", content: msg }
    const newHistory = [...chatHistory, userMsg]
    setChatHistory(newHistory)
    setQuery("")
    setLoading(true)

    const result = await askAI(msg, chatHistory)
    setLoading(false)

    let replyText: string
    if ("reply" in result) {
      replyText = result.reply
      setChatHistory([...newHistory, { role: "assistant", content: replyText }])
    } else {
      replyText = `Sorry, I couldn't process that: ${result.error}`
      setChatHistory([...newHistory, { role: "assistant", content: replyText }])
    }

    // Auto-speak the reply
    speakReply(replyText)
  }, [query, loading, chatHistory])

  // Speak AI reply using Sarvam TTS
  async function speakReply(text: string) {
    // Stop any currently playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    setSpeaking(true)
    const result = await synthesizeSpeech(text, detectedLang)

    if ("audioBase64" in result && result.audioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${result.audioBase64}`)
      currentAudioRef.current = audio
      audio.onended = () => {
        setSpeaking(false)
        currentAudioRef.current = null
      }
      audio.onerror = () => {
        setSpeaking(false)
        currentAudioRef.current = null
      }
      audio.play().catch(() => setSpeaking(false))
    } else {
      setSpeaking(false)
    }
  }

  // Stop speaking
  function stopSpeaking() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setSpeaking(false)
  }

  // Start voice recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

        // Convert to base64
        setTranscribing(true)
        const arrayBuffer = await audioBlob.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
        )

        // Transcribe
        const result = await transcribeAudio(base64)
        setTranscribing(false)

        if ("transcript" in result && result.transcript) {
          setDetectedLang(result.languageCode)
          // Auto-send the transcribed message
          handleSend(result.transcript)
        }
      }

      mediaRecorder.start()
      setRecording(true)
    } catch {
      // Microphone access denied
    }
  }

  // Stop voice recording
  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center",
            "rounded-full bg-primary text-primary-foreground shadow-lg",
            "transition-all hover:scale-105 hover:shadow-xl",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          )}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex flex-col",
            "w-[380px] max-h-[600px] rounded-2xl",
            "border border-border bg-background shadow-2xl",
            "animate-in slide-in-from-bottom-5 fade-in duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">AI Assistant</p>
                <p className="text-xs text-muted-foreground">JUST CLOTHING</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {speaking && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={stopSpeaking}>
                  <VolumeX className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "420px" }}>
            {chatHistory.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm font-medium">How can I help you?</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[260px]">
                  Ask about orders, inventory, production, or anything about your factory. Speak or type in any language.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                  {["How many orders are active?", "Low stock items?", "इस हफ्ते कितने ऑर्डर हैं?"].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-accent text-accent-foreground rounded-bl-md"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {(loading || transcribing) && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-accent px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {transcribing ? "Listening…" : "Thinking…"}
                  </div>
                </div>
              )}

              {speaking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-primary/5 px-3.5 py-2 text-xs text-muted-foreground">
                    <Volume2 className="h-3.5 w-3.5 text-primary animate-pulse" />
                    Speaking…
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type or tap mic to speak…"
                disabled={loading || transcribing || recording}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />

              {/* Mic button */}
              <Button
                variant={recording ? "destructive" : "ghost"}
                size="icon"
                className={cn("h-9 w-9 shrink-0", recording && "animate-pulse")}
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || transcribing}
              >
                {recording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              {/* Send button */}
              <Button
                variant="default"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleSend()}
                disabled={!query.trim() || loading || transcribing}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

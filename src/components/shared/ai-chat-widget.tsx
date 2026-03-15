"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  X,
  Mic,
  MicOff,
  Send,
  Loader2,
  Bot,
  Volume2,
  VolumeX,
  RotateCcw,
  Wand2,
  Check,
  Ban,
} from "lucide-react"

import { toast } from "sonner"
import { askAI, transcribeAudio, synthesizeSpeech, type ChatMessage } from "@/actions/ai"
import { askAgent, executeAgentTool } from "@/actions/ai-agent"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Write tools that require user confirmation before execution
const WRITE_TOOLS = new Set([
  "mark_attendance",
  "approve_leave",
  "reject_leave",
  "create_task",
  "update_task_status",
  "update_production_stage",
])

type UIMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | {
      role: "confirmation"
      displayText: string
      toolName: string
      toolArgs: Record<string, unknown>
      resolved: boolean
    }

function BoldText({ text }: { text: string }) {
  const parts = text.split("**")
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
      )}
    </>
  )
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [agentMode, setAgentMode] = useState(false)
  const [query, setQuery] = useState("")
  const [chatHistory, setChatHistory] = useState<UIMessage[]>([])
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatHistory, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function speakReply(text: string) {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setSpeaking(true)
    const result = await synthesizeSpeech(text, detectedLang)
    if ("audioBase64" in result && result.audioBase64) {
      const audio = new Audio(`data:audio/wav;base64,${result.audioBase64}`)
      currentAudioRef.current = audio
      audio.onended = () => { setSpeaking(false); currentAudioRef.current = null }
      audio.onerror = () => { setSpeaking(false); currentAudioRef.current = null }
      audio.play().catch(() => setSpeaking(false))
    } else {
      setSpeaking(false)
    }
  }

  function stopSpeaking() {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    setSpeaking(false)
  }

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? query).trim()
      if (!msg || loading) return

      const userMsg: UIMessage = { role: "user", content: msg }
      const newHistory = [...chatHistory, userMsg]
      setChatHistory(newHistory)
      setQuery("")
      setLoading(true)

      if (agentMode) {
        // ── Agent mode: route through Gemini function calling ──
        const agentHistory = chatHistory
          .filter((m): m is { role: "user"; content: string } | { role: "assistant"; content: string } =>
            m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }))
        const result = await askAgent(msg, agentHistory)
        setLoading(false)

        if ("error" in result) {
          const errMsg = `Error: ${result.error}`
          setChatHistory([...newHistory, { role: "assistant", content: errMsg }])
          return
        }

        if (result.type === "text") {
          setChatHistory([...newHistory, { role: "assistant", content: result.content }])
          speakReply(result.content)
          return
        }

        // tool_call
        if (WRITE_TOOLS.has(result.name)) {
          // Show confirmation card
          setChatHistory([...newHistory, {
            role: "confirmation",
            displayText: result.displayText,
            toolName: result.name,
            toolArgs: result.args,
            resolved: false,
          }])
        } else {
          // Read tool — execute immediately and show result
          const exec = await executeAgentTool(result.name, result.args)
          const replyText = exec.success ? exec.message : `Could not complete: ${exec.message}`
          setChatHistory([...newHistory, { role: "assistant", content: replyText }])
          speakReply(replyText)
        }
      } else {
        // ── Normal mode: Sarvam chat ──
        const chatMessages = chatHistory.filter(
          (m): m is ChatMessage => m.role === "user" || m.role === "assistant"
        )
        const result = await askAI(msg, chatMessages)
        setLoading(false)

        let replyText: string
        if ("reply" in result) {
          replyText = result.reply
          setChatHistory([...newHistory, { role: "assistant", content: replyText }])
        } else {
          replyText = `Sorry, I couldn't process that: ${result.error}`
          setChatHistory([...newHistory, { role: "assistant", content: replyText }])
        }
        speakReply(replyText)
      }
    },
    [query, loading, chatHistory, agentMode]
  )

  async function handleConfirm(index: number, toolName: string, toolArgs: Record<string, unknown>) {
    // Mark as resolved immediately to disable buttons
    setChatHistory((prev) =>
      prev.map((m, i) => i === index ? { ...m, resolved: true } : m)
    )

    const exec = await executeAgentTool(toolName, toolArgs)
    const replyText = exec.success ? `✓ Done — ${exec.message}` : `✗ Failed — ${exec.message}`
    setChatHistory((prev) => [...prev, { role: "assistant", content: replyText }])
    speakReply(replyText)
  }

  function handleCancel(index: number) {
    setChatHistory((prev) =>
      prev.map((m, i) => i === index ? { ...m, resolved: true } : m)
    )
    setChatHistory((prev) => [...prev, { role: "assistant", content: "Cancelled." }])
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setTranscribing(true)
        const arrayBuffer = await audioBlob.arrayBuffer()
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ""))
        const result = await transcribeAudio(base64)
        setTranscribing(false)
        if ("transcript" in result && result.transcript) {
          setDetectedLang(result.languageCode)
          handleSend(result.transcript)
        }
      }
      mediaRecorder.start()
      setRecording(true)
    } catch {
      toast.error("Microphone access denied. Please allow microphone permission in your browser.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop()
    setRecording(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function toggleAgentMode() {
    stopSpeaking()
    setChatHistory([])
    setQuery("")
    setAgentMode((v) => !v)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "flex flex-col",
            "w-[380px] max-h-[600px] rounded-2xl",
            "border border-border bg-background shadow-2xl",
            "animate-in slide-in-from-bottom-4 fade-in duration-200"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex items-center justify-between rounded-t-2xl border-b border-border px-4 py-3",
            agentMode
              ? "bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent"
              : "bg-gradient-to-r from-primary/8 via-primary/4 to-transparent"
          )}>
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-full shadow-sm",
                agentMode
                  ? "bg-gradient-to-br from-blue-500 to-blue-600"
                  : "bg-gradient-to-br from-primary to-primary/80"
              )}>
                {agentMode ? <Wand2 className="h-[18px] w-[18px] text-white" /> : <Bot className="h-[18px] w-[18px] text-primary-foreground" />}
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">
                  {agentMode ? "KYRE Agent" : "KYRE"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {agentMode ? "Executes actions in the app" : "AI Assistant"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {speaking && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={stopSpeaking}>
                  <VolumeX className="h-4 w-4" />
                </Button>
              )}
              {/* Agent mode toggle */}
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", agentMode ? "text-blue-500" : "text-muted-foreground hover:text-foreground")}
                onClick={toggleAgentMode}
                title={agentMode ? "Switch to chat mode" : "Switch to agent mode"}
              >
                <Wand2 className="h-4 w-4" />
              </Button>
              {chatHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => { stopSpeaking(); setChatHistory([]); setQuery("") }}
                  title="New chat"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: "420px" }}>
            {chatHistory.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className={cn(
                  "relative flex h-14 w-14 items-center justify-center rounded-2xl mb-3",
                  agentMode ? "bg-gradient-to-br from-blue-500/10 to-blue-500/5" : "bg-gradient-to-br from-primary/10 to-primary/5"
                )}>
                  {agentMode
                    ? <Wand2 className="h-7 w-7 text-blue-500" />
                    : <Bot className="h-7 w-7 text-primary" />
                  }
                </div>
                <p className="text-sm font-semibold">
                  {agentMode ? "What should I do?" : "How can I help you?"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[260px] leading-relaxed">
                  {agentMode
                    ? "Ask me to mark attendance, approve leaves, create tasks, update production stages, and more."
                    : "Ask about orders, inventory, production, or anything about your factory. Speak or type in any language."
                  }
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                  {agentMode
                    ? ["Mark Rajan as present", "Approve Priya's leave", "Create a task: check fabric"].map((q) => (
                        <button key={q} onClick={() => handleSend(q)}
                          className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-all hover:bg-blue-100">
                          {q}
                        </button>
                      ))
                    : ["How many orders are active?", "Low stock items?", "इस हफ्ते कितने ऑर्डर हैं?"].map((q) => (
                        <button key={q} onClick={() => handleSend(q)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:border-primary/20 hover:shadow-sm">
                          {q}
                        </button>
                      ))
                  }
                </div>
              </div>
            )}

            <div className="space-y-3">
              {chatHistory.map((msg, i) => {
                if (msg.role === "confirmation") {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-blue-200 bg-blue-50 px-4 py-3 space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">I'll do the following</p>
                        <p className="text-sm text-blue-900 leading-snug">
                          <BoldText text={msg.displayText} />
                        </p>
                        {!msg.resolved && (
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              className="h-7 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                              onClick={() => handleConfirm(i, msg.toolName, msg.toolArgs)}
                            >
                              <Check className="h-3 w-3" /> Confirm
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-100"
                              onClick={() => handleCancel(i)}
                            >
                              <Ban className="h-3 w-3" /> Cancel
                            </Button>
                          </div>
                        )}
                        {msg.resolved && (
                          <p className="text-[11px] text-blue-400 italic">Action resolved</p>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
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
                )
              })}

              {(loading || transcribing) && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-accent px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {transcribing ? "Listening…" : agentMode ? "Working…" : "Thinking…"}
                  </div>
                </div>
              )}

              {speaking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-primary/10 px-3.5 py-2 text-xs text-primary">
                    <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                    Speaking…
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-border px-3 py-3">
            <div className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-1.5",
              agentMode ? "bg-blue-50 border border-blue-100" : "bg-accent/50"
            )}>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={agentMode ? "Tell me what to do…" : "Ask anything about your factory…"}
                disabled={loading || transcribing || recording}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
              />
              <Button
                variant={recording ? "destructive" : "ghost"}
                size="icon"
                className={cn("h-8 w-8 shrink-0 rounded-lg", recording && "animate-pulse")}
                onClick={recording ? stopRecording : startRecording}
                disabled={loading || transcribing}
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                variant="default"
                size="icon"
                className={cn("h-8 w-8 shrink-0 rounded-lg", agentMode && "bg-blue-600 hover:bg-blue-700")}
                onClick={() => handleSend()}
                disabled={!query.trim() || loading || transcribing}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed FAB — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 shrink-0 select-none items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none"
        aria-label={open ? "Close KYRE" : "Open KYRE"}
      >
        {/* Breathing glow */}
        {!open && (
          <span
            className="absolute inset-[-6px] rounded-full opacity-40"
            style={{
              background: "radial-gradient(circle, hsl(16 65% 55% / .45) 0%, transparent 70%)",
              animation: "fab-breathe 3.5s ease-in-out infinite",
            }}
          />
        )}

        {/* Gradient background */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-[hsl(16,65%,60%)] via-primary to-[hsl(16,65%,42%)] p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[hsl(16,65%,52%)] to-[hsl(16,65%,45%)]" />
        </span>

        {/* Highlight */}
        <span className="absolute left-2.5 top-1.5 h-2.5 w-6 rounded-full bg-white/25 blur-[3px]" />

        {/* Icon */}
        <span className="relative z-10">
          {open ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.477 2 2 5.804 2 10.5c0 2.447 1.17 4.652 3.05 6.207L4 21l4.14-2.07A11.27 11.27 0 0 0 12 19.5c5.523 0 10-3.804 10-8.5S17.523 2 12 2Z"
                fill="white"
                fillOpacity="0.95"
              />
              <circle cx="8.5" cy="10.5" r="1.15" fill="hsl(16,65%,50%)" />
              <circle cx="12" cy="10.5" r="1.15" fill="hsl(16,65%,50%)" />
              <circle cx="15.5" cy="10.5" r="1.15" fill="hsl(16,65%,50%)" />
              <path d="M18.5 4l.35 1.15L20 5.5l-1.15.35L18.5 7l-.35-1.15L17 5.5l1.15-.35L18.5 4Z" fill="white" fillOpacity="0.85" />
            </svg>
          )}
        </span>

        <style jsx>{`
          @keyframes fab-breathe {
            0%, 100% { transform: scale(1); opacity: 0.35; }
            50% { transform: scale(1.18); opacity: 0.55; }
          }
        `}</style>
      </button>
    </div>
  )
}

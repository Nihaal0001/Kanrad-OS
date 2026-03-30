export interface Insight {
  type: "warning" | "suggestion" | "alert"
  title: string
  description: string
  action?: { label: string; href: string }
}

export interface Suggestion {
  label: string
  description: string
  href: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

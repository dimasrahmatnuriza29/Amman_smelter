"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopilotChatProps {
  machineId: string | null;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Kenapa health mesin turun?",
  "Apakah perlu shutdown?",
  "Suhu normal untuk mesin ini?",
  "Apa penyebab anomaly?",
];

export default function CopilotChat({ machineId, expanded, onExpand, onClose }: CopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          machineId,
          history: messages,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
      };
      setMessages([...newMessages, assistantMsg]);
    } catch (e) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: `Error: ${(e as Error).message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {expanded && (
        <div
          className="copilot-backdrop fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          "flex flex-col rounded-xl border border-border bg-surface overflow-hidden",
          expanded
            ? "fixed inset-4 z-50 copilot-panel-expanded-chat"
            : "h-full transition-all duration-200"
        )}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple/15">
            <MessageSquare size={15} className="text-purple" />
          </div>
          <div>
            <h3 className={cn("font-semibold", expanded ? "text-base" : "text-sm")}>Maintenance Copilot</h3>
            <p className="text-[10px] text-muted">
              {machineId ? `Context: ${machineId}` : "General Q&A (RAG)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {expanded ? (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          ) : (
            <button
              onClick={onExpand}
              className="copilot-expand-btn flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-purple hover:bg-purple/10 transition-colors"
              title="Expand"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3"
      >
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <p className="text-center text-xs text-muted">
              Ask anything about the asset...
            </p>
            <div className="flex flex-col gap-1.5 w-full">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-left text-[11px] text-muted hover:text-foreground hover:border-surface-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 leading-relaxed",
                expanded ? "text-sm" : "text-[11px]",
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-surface-2 text-foreground"
              )}
            >
              <pre className="whitespace-pre-wrap font-sans">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
              <Loader2 size={12} className="animate-spin text-muted" />
              <span className="text-[11px] text-muted">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask anything about the asset..."
            disabled={loading}
            className={cn("flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors disabled:opacity-50", expanded ? "text-sm" : "text-xs")}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-30 hover:bg-primary/80 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

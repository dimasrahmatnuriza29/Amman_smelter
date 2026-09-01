"use client";

import { useState, useRef, useEffect, memo } from "react";
import { MessageSquare, Send, Loader2, Maximize2, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownChart, parseChartFromCode } from "@/components/MarkdownChart";

interface CopilotChatProps {
  machineId: string | null;
  expanded: boolean;
  onExpand: () => void;
  onClose: () => void;
  filterMonth?: number;
  filterYear?: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "Ringkasan kondisi smelter",
  "Mesin mana yang butuh perhatian?",
  "Apa itu bearing wear dan cara mendeteksinya?",
  "Berapa suhu normal furnace?",
  "Kenapa health mesin turun?",
];

const markdownComponents = {
  h1: ({ node, ...props }: any) => <h1 className="text-base font-bold mt-3 mb-1.5 first:mt-0" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-sm font-bold mt-3 mb-1.5 first:mt-0" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-sm font-semibold mt-2.5 mb-1 first:mt-0" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />,
  li: ({ node, ...props }: any) => <li className="leading-relaxed" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-bold text-foreground" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic text-muted" {...props} />,
  code: ({ node, className, children, ...props }: any) => {
    const content = String(children).replace(/\n$/, "");
    const lang = className?.replace(/language-/, "") || "";
    const chart = parseChartFromCode(lang, content);
    if (chart) return <MarkdownChart chart={chart} />;
    return <code className="rounded bg-surface px-1 py-0.5 text-[10px] font-mono" {...props}>{children}</code>;
  },
  pre: ({ node, children, ...props }: any) => <pre className="rounded-lg bg-surface p-2 mb-2 overflow-x-auto text-[10px]" {...props}>{children}</pre>,
  hr: ({ node, ...props }: any) => <hr className="border-border my-2" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted mb-2" {...props} />,
  table: ({ node, ...props }: any) => <table className="w-full border-collapse mb-2" {...props} />,
  th: ({ node, ...props }: any) => <th className="border border-border px-2 py-1 text-left font-semibold bg-surface" {...props} />,
  td: ({ node, ...props }: any) => <td className="border border-border px-2 py-1" {...props} />,
  a: ({ node, ...props }: any) => <a className="text-primary underline" target="_blank" rel="noopener noreferrer" {...props} />,
};

const MessageBubble = memo(function MessageBubble({ msg, expanded }: { msg: ChatMessage; expanded: boolean }) {
  return (
    <div
      className={cn(
        "flex",
        msg.role === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-lg px-3 py-2 leading-relaxed",
          expanded ? "text-sm" : "text-[11px]",
          msg.role === "user"
            ? "bg-primary text-white"
            : "bg-surface-2 text-foreground"
        )}
      >
        {msg.role === "user" ? (
          <p className="whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});

export default function CopilotChat({ machineId, expanded, onExpand, onClose, filterMonth, filterYear }: CopilotChatProps) {
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
          month: filterMonth,
          year: filterYear,
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
            ? "fixed inset-2 sm:inset-4 z-50 copilot-panel-expanded-chat"
            : "h-full min-h-[420px] shrink-0 lg:min-h-0 lg:shrink transition-all duration-200"
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
              {machineId ? `Context: ${machineId}` : "Smelter Maintenance AI"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              disabled={loading}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors disabled:opacity-30"
              title="Clear chat"
            >
              <RotateCcw size={13} />
            </button>
          )}
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
              Tanya apa saja tentang smelter — diagnosis, rekomendasi, atau konsultasi
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
          <MessageBubble key={i} msg={msg} expanded={expanded} />
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
            placeholder="Tanya apa saja tentang smelter..."
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

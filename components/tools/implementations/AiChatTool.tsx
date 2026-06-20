"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import type { AIModelId, AIMessage } from "@/types/ai";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

// ── Model tiers ───────────────────────────────────────────────────────────────

const MODEL_TIERS = [
  {
    id: "fast" as const,
    label: "Fast",
    icon: "bolt",
    description: "Gemini 2.5 Flash",
    modelId: "gemini-2.5-flash" as AIModelId,
  },
  {
    id: "balanced" as const,
    label: "Balanced",
    icon: "balance",
    description: "Gemini 2.0 Flash",
    modelId: "gemini-2.0-flash" as AIModelId,
  },
  {
    id: "premium" as const,
    label: "Premium",
    icon: "auto_awesome",
    description: "Gemini 2.5 Pro",
    modelId: "gemini-2.5-pro" as AIModelId,
  },
] as const;
type Tier = (typeof MODEL_TIERS)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makeConversation(): Conversation {
  return { id: genId(), title: "New Chat", messages: [], createdAt: Date.now() };
}

function getTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "New Chat";
  return first.length > 40 ? first.slice(0, 40) + "…" : first;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

const INLINE_RE =
  /`([^`]+)`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__|_(.+?)_|\[([^\]]+)\]\(([^)]+)\)/g;

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const k = `i${i++}`;
    if (m[1] !== undefined)
      nodes.push(<code key={k} className="bg-[rgba(255,255,255,0.1)] text-[#4cd7f6] px-1.5 py-0.5 rounded text-[0.85em] font-mono">{m[1]}</code>);
    else if (m[2] !== undefined)
      nodes.push(<strong key={k}><em>{m[2]}</em></strong>);
    else if (m[3] !== undefined)
      nodes.push(<strong key={k} className="font-bold text-[#e2e2e2]">{m[3]}</strong>);
    else if (m[4] !== undefined || m[6] !== undefined)
      nodes.push(<em key={k} className="italic">{m[4] ?? m[6]}</em>);
    else if (m[5] !== undefined)
      nodes.push(<strong key={k} className="font-bold text-[#e2e2e2]">{m[5]}</strong>);
    else if (m[7] !== undefined)
      nodes.push(<a key={k} href={m[8]} target="_blank" rel="noopener noreferrer" className="text-[#4cd7f6] underline underline-offset-2 hover:text-[#ddb7ff] transition-colors">{m[7]}</a>);
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function TableBlock({ lines }: { lines: string[] }) {
  const rows = lines
    .filter((l) => !l.match(/^\|[-| :]+\|$/))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim())
    );
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} className="border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-left text-[#ddb7ff] bg-[rgba(221,183,255,0.08)] font-semibold">
                {parseInline(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="even:bg-[rgba(255,255,255,0.03)]">
              {row.map((c, ci) => (
                <td key={ci} className="border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[#c8bbd4]">
                  {parseInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);
  return (
    <div className="my-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.4)" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <span className="text-[11px] font-mono text-[#6b5b7a] uppercase tracking-widest">{lang || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors" style={{ color: copied ? "#22c55e" : "#6b5b7a" }}>
          <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 overflow-x-auto text-[13px] font-mono text-[#c8bbd4] leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  // Split on fenced code blocks (handles unclosed fences in streaming)
  const segments = content.split(/(```[^\n]*\n[\s\S]*?```|```[^\n]*\n[\s\S]*$)/);

  const blocks: React.ReactNode[] = [];
  let bk = 0;

  for (const seg of segments) {
    if (seg.startsWith("```")) {
      const firstNl = seg.indexOf("\n");
      const lang = firstNl > 3 ? seg.slice(3, firstNl).trim() : "";
      const code = seg.slice(firstNl + 1).replace(/```$/, "").replace(/\n$/, "");
      blocks.push(<CodeBlock key={bk++} lang={lang} code={code} />);
      continue;
    }

    const lines = seg.split("\n");
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === "") { i++; continue; }

      // Heading
      const hm = line.match(/^(#{1,4})\s+(.+)/);
      if (hm) {
        const lvl = hm[1].length;
        const cls = lvl === 1
          ? "text-[18px] font-bold text-[#e2e2e2] mt-4 mb-2"
          : lvl === 2
          ? "text-[16px] font-bold text-[#e2e2e2] mt-3 mb-1.5"
          : "text-[14px] font-semibold text-[#ddb7ff] mt-3 mb-1";
        blocks.push(<p key={bk++} className={cls}>{parseInline(hm[2])}</p>);
        i++; continue;
      }

      // HR
      if (line.match(/^(---+|\*\*\*+|___+)$/)) {
        blocks.push(<hr key={bk++} className="my-3 border-[rgba(255,255,255,0.1)]" />);
        i++; continue;
      }

      // Blockquote
      if (line.startsWith("> ")) {
        blocks.push(
          <blockquote key={bk++} className="border-l-2 border-[#ddb7ff] pl-3 my-2 text-[#9b8da8] italic text-[13.5px]">
            {parseInline(line.slice(2))}
          </blockquote>
        );
        i++; continue;
      }

      // Unordered list
      if (line.match(/^[-*+]\s/)) {
        const items: string[] = [];
        while (i < lines.length && lines[i].match(/^[-*+]\s/)) {
          items.push(lines[i].replace(/^[-*+]\s/, ""));
          i++;
        }
        blocks.push(
          <ul key={bk++} className="list-none my-2 flex flex-col gap-1">
            {items.map((it, j) => (
              <li key={j} className="flex gap-2 text-[14px] text-[#c8bbd4] leading-relaxed">
                <span className="text-[#ddb7ff] mt-0.5 flex-shrink-0">•</span>
                <span>{parseInline(it)}</span>
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // Ordered list
      if (line.match(/^\d+[.)]\s/)) {
        const items: string[] = [];
        let num = 1;
        while (i < lines.length && lines[i].match(/^\d+[.)]\s/)) {
          items.push(lines[i].replace(/^\d+[.)]\s/, ""));
          i++;
        }
        blocks.push(
          <ol key={bk++} className="list-none my-2 flex flex-col gap-1">
            {items.map((it, j) => (
              <li key={j} className="flex gap-2 text-[14px] text-[#c8bbd4] leading-relaxed">
                <span className="text-[#ddb7ff] font-semibold flex-shrink-0 w-5 text-right">{num++ + j}.</span>
                <span>{parseInline(it)}</span>
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // Table
      if (line.includes("|") && line.trim().startsWith("|")) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim().startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        blocks.push(<TableBlock key={bk++} lines={tableLines} />);
        continue;
      }

      // Paragraph
      const pLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].match(/^(#{1,4}\s|[-*+]\s|\d+[.)]\s|> |---|```|\|)/)
      ) {
        pLines.push(lines[i]);
        i++;
      }
      if (pLines.length) {
        blocks.push(
          <p key={bk++} className="text-[14px] text-[#c8bbd4] leading-[1.75] my-1">
            {parseInline(pLines.join(" "))}
          </p>
        );
      }
    }
  }

  return <div className="flex flex-col gap-0.5">{blocks}</div>;
});

// ── MessageBubble ─────────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ChatMessage;
  isLast: boolean;
  isStreaming: boolean;
  onCopy: (content: string) => void;
  onRegenerate: () => void;
  onEdit: (id: string, content: string) => void;
  copiedId: string | null;
}

const MessageBubble = memo(function MessageBubble({
  msg, isLast, isStreaming, onCopy, onRegenerate, onEdit, copiedId,
}: BubbleProps) {
  const isUser = msg.role === "user";
  const isCopied = copiedId === msg.id;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const textaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textaRef.current) {
      textaRef.current.focus();
      textaRef.current.style.height = "auto";
      textaRef.current.style.height = textaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  function submitEdit() {
    const v = editValue.trim();
    if (!v) return;
    onEdit(msg.id, v);
    setEditing(false);
  }

  return (
    <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
      {/* Label */}
      <div className="flex items-center gap-1.5 px-1">
        {!isUser && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(221,183,255,0.2)" }}>
            <span className="material-symbols-outlined text-[11px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          </div>
        )}
        <span className="text-[11px] text-[#4d4354]">{isUser ? "You" : "AI"} · {formatTime(msg.timestamp)}</span>
      </div>

      {/* Bubble */}
      {editing ? (
        <div className="w-full max-w-[85%]">
          <textarea
            ref={textaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); }
              if (e.key === "Escape") { setEditing(false); setEditValue(msg.content); }
            }}
            rows={3}
            className="w-full bg-[rgba(0,0,0,0.3)] border border-[#ddb7ff] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={() => { setEditing(false); setEditValue(msg.content); }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#6b5b7a]" style={{ background: "rgba(255,255,255,0.05)" }}>
              Cancel
            </button>
            <button onClick={submitEdit}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#131313]" style={{ background: "linear-gradient(135deg, #ddb7ff, #4cd7f6)" }}>
              Send
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}
          style={{
            background: isUser
              ? "linear-gradient(135deg, rgba(221,183,255,0.18), rgba(76,215,246,0.1))"
              : "rgba(255,255,255,0.05)",
            border: isUser
              ? "1px solid rgba(221,183,255,0.25)"
              : "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {isUser ? (
            <p className="text-[14px] text-[#e2e2e2] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <>
              <MarkdownRenderer content={msg.content} />
              {isStreaming && isLast && (
                <span className="inline-block w-0.5 h-4 bg-[#ddb7ff] ml-0.5 align-middle animate-pulse" aria-hidden />
              )}
            </>
          )}
        </div>
      )}

      {/* Actions */}
      {!editing && !isStreaming && (
        <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
          <button
            onClick={() => onCopy(msg.content)} aria-label="Copy"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors"
            style={{ color: isCopied ? "#22c55e" : "#4d4354", background: "transparent" }}
          >
            <span className="material-symbols-outlined text-[13px]">{isCopied ? "check" : "content_copy"}</span>
            {isCopied ? "Copied" : "Copy"}
          </button>
          {isUser && (
            <button
              onClick={() => setEditing(true)} aria-label="Edit"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#4d4354] transition-colors hover:text-[#988d9f]"
            >
              <span className="material-symbols-outlined text-[13px]">edit</span>
              Edit
            </button>
          )}
          {!isUser && isLast && (
            <button
              onClick={onRegenerate} aria-label="Regenerate"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#4d4354] transition-colors hover:text-[#988d9f]"
            >
              <span className="material-symbols-outlined text-[13px]">refresh</span>
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onClear: () => void;
}

function Sidebar({ conversations, activeId, open, onClose, onNew, onSelect, onClear }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} aria-hidden />
      )}

      <aside
        className={`flex-shrink-0 flex flex-col gap-3 z-40 transition-transform duration-300
          fixed inset-y-0 left-0 w-64 lg:relative lg:translate-x-0 lg:inset-auto lg:w-56 xl:w-64
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background: "rgba(13,10,18,0.97)",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "64px",
        }}
        aria-label="Chat sidebar"
      >
        <div className="flex flex-col gap-2 px-3 pt-4 pb-2">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all w-full"
            style={{ background: "linear-gradient(135deg, rgba(221,183,255,0.15), rgba(76,215,246,0.08))", border: "1px solid rgba(221,183,255,0.2)", color: "#ddb7ff" }}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 flex flex-col gap-1">
          {conversations.length === 0 && (
            <p className="text-[12px] text-[#4d4354] px-2 py-3 text-center">No conversations yet</p>
          )}
          {[...conversations].reverse().map((conv) => (
            <button
              key={conv.id}
              onClick={() => { onSelect(conv.id); onClose(); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-[12.5px] transition-all"
              style={{
                background: conv.id === activeId ? "rgba(221,183,255,0.1)" : "transparent",
                border: `1px solid ${conv.id === activeId ? "rgba(221,183,255,0.15)" : "transparent"}`,
                color: conv.id === activeId ? "#ddb7ff" : "#6b5b7a",
              }}
            >
              <p className="truncate font-medium">{conv.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: conv.id === activeId ? "rgba(221,183,255,0.5)" : "#4d4354" }}>
                {conv.messages.length} message{conv.messages.length !== 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>

        <div className="px-3 pb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all w-full"
            style={{ color: "#6b5b7a", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
            Clear All Chats
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Starter prompts ───────────────────────────────────────────────────────────

const STARTERS = [
  { icon: "code", label: "Write code", prompt: "Write a Python function that sorts a list of dictionaries by a given key." },
  { icon: "edit_note", label: "Draft content", prompt: "Write a professional LinkedIn post announcing a new job position." },
  { icon: "psychology", label: "Brainstorm", prompt: "Give me 10 creative name ideas for a tech startup that builds productivity tools." },
  { icon: "translate", label: "Explain a concept", prompt: "Explain how neural networks work in simple terms, with an analogy." },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiChatTool() {
  const [conversations, setConversations] = useState<Conversation[]>(() => [makeConversation()]);
  const [activeId, setActiveId] = useState<string>(() => conversations[0].id);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tier, setTier] = useState<Tier>("fast");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef   = useRef<AbortController | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const textaRef   = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const messages   = activeConv.messages;
  const modelId    = MODEL_TIERS.find((t) => t.id === tier)!.modelId;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  function resizeTextarea() {
    const el = textaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  // Update a conversation in state
  const updateConv = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  // Send messages to /api/ai
  const sendMessages = useCallback(async (convId: string, msgs: ChatMessage[]) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsStreaming(true);
    setError(null);

    const assistantId = genId();
    // Append empty assistant bubble immediately
    updateConv(convId, (c) => ({
      ...c,
      messages: [...msgs, { id: assistantId, role: "assistant", content: "", timestamp: Date.now() }],
    }));

    try {
      const apiMessages: AIMessage[] = msgs.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "chat",
          messages: apiMessages,
          options: { stream: true, model: modelId, maxTokens: 2048 },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { message?: string }).message ?? `Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream.");

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        updateConv(convId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, content: snap } : m
          ),
        }));
      }
      // Update title after first exchange
      updateConv(convId, (c) => ({
        ...c,
        title: c.title === "New Chat" ? getTitle(c.messages) : c.title,
      }));
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Streaming stopped by user — keep accumulated text
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      // Remove the empty assistant bubble on error
      updateConv(convId, (c) => ({
        ...c,
        messages: c.messages.filter((m) => m.id !== assistantId || m.content),
      }));
    } finally {
      setIsStreaming(false);
    }
  }, [modelId, updateConv]);

  const handleSend = useCallback(async (overrideValue?: string) => {
    const text = (overrideValue ?? inputValue).trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { id: genId(), role: "user", content: text, timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];

    updateConv(activeId, (c) => ({ ...c, messages: nextMessages }));
    setInputValue("");
    if (textaRef.current) { textaRef.current.style.height = "auto"; }

    await sendMessages(activeId, nextMessages);
  }, [inputValue, isStreaming, messages, activeId, updateConv, sendMessages]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    const conv = makeConversation();
    setConversations((prev) => [...prev, conv]);
    setActiveId(conv.id);
    setError(null);
  }, []);

  const handleSelectConv = useCallback((id: string) => {
    setActiveId(id);
    setError(null);
    abortRef.current?.abort();
  }, []);

  const handleClearAll = useCallback(() => {
    abortRef.current?.abort();
    const conv = makeConversation();
    setConversations([conv]);
    setActiveId(conv.id);
    setError(null);
  }, []);

  const handleCopy = useCallback((content: string, id?: string) => {
    navigator.clipboard.writeText(content);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (isStreaming) return;
    // Remove last assistant message and resend
    const withoutLast = messages.filter((_, i) => i < messages.length - 1);
    if (!withoutLast.length) return;
    updateConv(activeId, (c) => ({ ...c, messages: withoutLast }));
    await sendMessages(activeId, withoutLast);
  }, [isStreaming, messages, activeId, updateConv, sendMessages]);

  const handleEdit = useCallback(async (msgId: string, newContent: string) => {
    if (isStreaming) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const truncated = messages.slice(0, idx);
    const editedMsg: ChatMessage = { ...messages[idx], content: newContent, timestamp: Date.now() };
    const nextMessages = [...truncated, editedMsg];
    updateConv(activeId, (c) => ({ ...c, messages: nextMessages }));
    await sendMessages(activeId, nextMessages);
  }, [isStreaming, messages, activeId, updateConv, sendMessages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="mb-12 flex flex-col gap-4">
      {/* Model tier selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-[#4d4354] font-semibold uppercase tracking-wider">Model:</span>
        {MODEL_TIERS.map((t) => {
          const active = tier === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
              style={{
                background: active ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                color: active ? "#ddb7ff" : "#6b5b7a",
              }}
              title={t.description}
            >
              <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
        <span className="text-[11px] text-[#4d4354] ml-1">
          {MODEL_TIERS.find((t) => t.id === tier)?.description} · {MODEL_TIERS.find((t) => t.id === tier)?.modelId}
        </span>
      </div>

      {/* Chat container */}
      <div
        className="flex overflow-hidden rounded-2xl"
        style={{
          height: "min(75vh, 700px)",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "#0d0a12",
        }}
      >
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNew={handleNewChat}
          onSelect={handleSelectConv}
          onClear={handleClearAll}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.2)" }}
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ background: "rgba(255,255,255,0.06)", color: "#6b5b7a" }}
              aria-label="Open sidebar"
            >
              <span className="material-symbols-outlined text-[16px]">menu</span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#e2e2e2] truncate">{activeConv.title}</p>
              <p className="text-[11px] text-[#4d4354]">{messages.length} message{messages.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold hidden sm:flex transition-all"
              style={{ background: "rgba(221,183,255,0.08)", border: "1px solid rgba(221,183,255,0.15)", color: "#ddb7ff" }}
            >
              <span className="material-symbols-outlined text-[13px]">add</span>
              New
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6" role="log" aria-live="polite" aria-label="Chat messages">
            {isEmpty ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(221,183,255,0.1)" }}>
                    <span className="material-symbols-outlined text-[28px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">How can I help you today?</p>
                  <p className="text-[13px] text-[#4d4354]">Ask me anything — I&apos;m here to help.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSend(s.prompt)}
                      className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#6b5b7a" }}
                    >
                      <span className="material-symbols-outlined text-[15px] text-[#ddb7ff] mt-0.5 flex-shrink-0">{s.icon}</span>
                      <span className="text-[12px] leading-relaxed">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isLast={idx === messages.length - 1}
                  isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
                  onCopy={(c) => handleCopy(c, msg.id)}
                  onRegenerate={handleRegenerate}
                  onEdit={handleEdit}
                  copiedId={copiedId}
                />
              ))
            )}

            {/* Loading dots when assistant bubble not yet appended */}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(221,183,255,0.2)" }}>
                  <span className="material-symbols-outlined text-[11px] text-[#ddb7ff]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#ddb7ff] animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl" role="alert" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#ef4444]">error</span>
                <p className="text-[13px] text-[#ef4444]">{error}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.15)" }}>
            <div
              className="flex items-end gap-2 rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <textarea
                ref={textaRef}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); resizeTextarea(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
                rows={1}
                disabled={isStreaming}
                aria-label="Message input"
                className="flex-1 bg-transparent text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none resize-none leading-relaxed min-h-[24px] max-h-[180px] overflow-y-auto"
                style={{ paddingTop: "4px", paddingBottom: "4px" }}
              />
              <div className="flex items-center gap-1.5 pb-0.5 flex-shrink-0">
                {isStreaming ? (
                  <button
                    onClick={handleStop}
                    aria-label="Stop generating"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
                    style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}
                  >
                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>stop</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim()}
                    aria-label="Send message"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{
                      background: inputValue.trim() ? "linear-gradient(135deg, #ddb7ff, #4cd7f6)" : "rgba(255,255,255,0.06)",
                      color: inputValue.trim() ? "#131313" : "#4d4354",
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                  </button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#4d4354] mt-1.5 text-center">
              AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

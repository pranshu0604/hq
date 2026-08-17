"use client";

import { useEffect, useRef, useState } from "react";
import { HqMark } from "@/components/logo";

type Msg = { role: "user" | "assistant"; content: string; actions?: number; error?: boolean };

const SUGGESTIONS = [
  "Add a note: …",
  "Log a chest + arms workout",
  "Who am I overdue to reach out to?",
  "Add a todo to renew my passport, high priority",
];

export default function AssistantChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const fresh = messages.length === 0;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, fresh }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        data.error
          ? { role: "assistant", content: data.error, error: true }
          : { role: "assistant", content: data.reply || "(no reply)", actions: data.actions },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Couldn't reach the assistant.", error: true }]);
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  };

  const newChat = () => {
    setMessages([]);
    setInput("");
    fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "", fresh: true }) }).catch(() => {});
    taRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-1 py-2 space-y-5 min-h-0">
        {messages.length === 0 ? (
          <div className={`text-center ${compact ? "pt-6" : "pt-10"} reveal`}>
            <HqMark className="h-11 w-11 mx-auto rounded-xl shadow-[0_4px_16px_-4px_var(--accent)]" />
            <h2 className={`display ${compact ? "text-xl" : "text-2xl"} mt-4`}>Talk to your HQ.</h2>
            {!compact && (
              <p className="text-ink-dim text-sm mt-2 max-w-md mx-auto">
                Tell me what to add, log, update or find — across your notes, applications, todos, reflections, people, gym and more.
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => (s.endsWith("…") ? (setInput(s.replace(" …", ": ")), taRef.current?.focus()) : send(s))}
                  className="text-[12px] rounded-full border border-line px-3 py-1.5 text-ink-dim hover:text-accent hover:border-accent/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex justify-end -mb-2">
            <button onClick={newChat} className="label hover:text-accent transition-colors">+ new chat</button>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end reveal-row">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-selected border border-accent/20 px-4 py-2.5 text-sm whitespace-pre-wrap">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-3 reveal-row">
              <HqMark className="h-7 w-7 rounded-lg shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className={`text-sm leading-relaxed whitespace-pre-wrap ${m.error ? "text-bad" : "text-ink"}`}>{m.content}</div>
                {m.actions ? <div className="label mt-1.5 text-accent">✦ {m.actions} action{m.actions === 1 ? "" : "s"} taken</div> : null}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex gap-3">
            <HqMark className="h-7 w-7 rounded-lg shrink-0 mt-0.5 opacity-70" />
            <div className="flex items-center gap-1 mt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce" />
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 shrink-0">
        <div className="card p-2 flex items-end gap-2">
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask HQ to add, log, update or find…"
            className="flex-1 bg-transparent border-none resize-none text-sm px-2 py-2 focus:outline-none max-h-40"
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="btn btn-accent shrink-0 h-9 px-4">
            {busy ? "…" : "Send"}
          </button>
        </div>
        {!compact && <div className="label text-center mt-2 text-ink-faint">Runs locally through your Gemini CLI — nothing leaves your machine except your prompts.</div>}
      </div>
    </div>
  );
}

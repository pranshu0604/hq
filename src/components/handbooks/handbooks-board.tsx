"use client";

// Upload HTML handbooks, then open them rendered (new tab) or preview inline.
// Files are read in the browser and their HTML is stored in HQ.
import { useRef, useState } from "react";
import type { HandbookMeta } from "@/lib/handbooks";

const MAX_BYTES = 8 * 1024 * 1024;

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function titleFromName(name: string) {
  return name.replace(/\.(html?|xhtml)$/i, "").replace(/[-_]+/g, " ").trim();
}

export default function HandbooksBoard({ initial }: { initial: HandbookMeta[] }) {
  const [rows, setRows] = useState<HandbookMeta[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await fetch("/api/handbooks", { cache: "no-store" });
    const data = await res.json();
    setRows(data.handbooks ?? []);
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg("");
    let ok = 0;
    let failed = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        failed++;
        continue;
      }
      try {
        const content = await file.text();
        const res = await fetch("/api/handbooks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: titleFromName(file.name), content }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    await refresh();
    setBusy(false);
    setMsg(`${ok} uploaded${failed ? ` · ${failed} failed (too large or unreadable)` : ""}`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const post = async (method: "PATCH" | "DELETE", payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      await fetch("/api/handbooks", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveRename = async (id: string) => {
    const t = draftTitle.trim();
    setRenamingId(null);
    if (t) {
      setRows((r) => r.map((x) => (x.id === id ? { ...x, title: t } : x)));
      await post("PATCH", { id, title: t });
    }
  };

  return (
    <div className="space-y-6">
      {/* uploader */}
      <label
        className="card card-interactive p-6 flex flex-col items-center justify-center text-center cursor-pointer border-dashed"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          uploadFiles(e.dataTransfer.files);
        }}
      >
        <input ref={fileRef} type="file" accept=".html,.htm,.xhtml,text/html" multiple className="hidden" onChange={(e) => uploadFiles(e.target.files)} />
        <div className="text-2xl mb-1">＋</div>
        <div className="text-sm text-ink">{busy ? "Uploading…" : "Upload HTML handbooks"}</div>
        <div className="label text-ink-faint mt-1">click or drop .html files · up to 8&nbsp;MB each</div>
        {msg && <div className="label text-accent mt-2">{msg}</div>}
      </label>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-faint">No handbooks yet. Upload the HTML files you&apos;ve built and they&apos;ll live here.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((h) => (
            <div key={h.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {renamingId === h.id ? (
                    <input
                      value={draftTitle}
                      autoFocus
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => saveRename(h.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(h.id);
                        else if (e.key === "Escape") setRenamingId(null);
                      }}
                      className="field-input w-full text-sm"
                    />
                  ) : (
                    <div className="text-[15px] text-ink truncate">{h.title}</div>
                  )}
                  <div className="label text-ink-faint mt-0.5">
                    {fmtSize(h.sizeBytes)} · {fmtDate(h.updatedAt)}
                  </div>
                </div>
                <a href={`/handbooks/${h.id}/raw`} target="_blank" rel="noopener noreferrer" className="btn btn-primary text-xs shrink-0">
                  Open ↗
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-line-soft">
                <button disabled={busy} onClick={() => setViewingId((v) => (v === h.id ? null : h.id))} className="btn btn-ghost text-xs">
                  {viewingId === h.id ? "Hide preview" : "Preview here"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setRenamingId(h.id);
                    setDraftTitle(h.title);
                  }}
                  className="btn btn-ghost text-xs"
                >
                  Rename
                </button>
                <button disabled={busy} onClick={() => post("DELETE", { id: h.id })} className="btn btn-ghost text-xs text-bad ml-auto">
                  Delete
                </button>
              </div>

              {viewingId === h.id && (
                <div className="mt-3 rounded-lg overflow-hidden border border-line">
                  {/* sandboxed: scripts run, but a null origin means it can't touch HQ */}
                  <iframe src={`/handbooks/${h.id}/raw`} title={h.title} className="w-full h-[70vh] bg-white" sandbox="allow-scripts allow-popups allow-forms allow-modals" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

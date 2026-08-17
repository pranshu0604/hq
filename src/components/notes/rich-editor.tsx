"use client";

import { useEffect, useReducer, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { InlineMention } from "@/components/notes/mention-suggestion";
import { LinkPreview } from "@/components/notes/link-preview";
import { isBareUrl, unfurl, uploadImage } from "@/lib/rich-media";

function insertAtSelection(view: EditorView, name: string, attrs: Record<string, unknown>) {
  const type = view.state.schema.nodes[name];
  if (!type) return;
  view.dispatch(view.state.tr.replaceSelectionWith(type.create(attrs)).scrollIntoView());
}

function insertAt(view: EditorView, pos: number, name: string, attrs: Record<string, unknown>) {
  const type = view.state.schema.nodes[name];
  if (!type) return;
  const p = Math.min(Math.max(0, pos), view.state.doc.content.size);
  view.dispatch(view.state.tr.insert(p, type.create(attrs)).scrollIntoView());
}

// enrich an already-inserted (bare) link-preview card once its OG data arrives
function enrichPreview(view: EditorView, url: string, meta: Record<string, unknown>) {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === "linkPreview" && node.attrs.url === url && !node.attrs.image && !node.attrs.title) {
      found = pos;
      return false;
    }
    return undefined;
  });
  if (found < 0) return;
  const node = view.state.doc.nodeAt(found);
  if (!node) return;
  view.dispatch(view.state.tr.setNodeMarkup(found, undefined, { ...node.attrs, ...meta }));
}

function handleImageFiles(view: EditorView, files: File[], pos: number | null) {
  files.forEach(async (f) => {
    const url = await uploadImage(f);
    if (!url) return;
    if (pos == null) insertAtSelection(view, "image", { src: url });
    else insertAt(view, pos, "image", { src: url });
  });
}

function handleBareUrl(view: EditorView, url: string, pos: number | null = null) {
  if (pos == null) insertAtSelection(view, "linkPreview", { url, title: "", description: "", image: "", siteName: "" });
  else insertAt(view, pos, "linkPreview", { url, title: "", description: "", image: "", siteName: "" });
  unfurl(url).then((meta) => {
    if (meta) enrichPreview(view, url, { title: meta.title, description: meta.description, image: meta.image, siteName: meta.siteName });
  });
}

export default function RichEditor({
  initialHTML,
  onChange,
  placeholder = "Start writing… type @ to link anything, paste an image or a URL.",
}: {
  initialHTML: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      InlineMention,
      Image.configure({ inline: false, HTMLAttributes: { class: "rte-img" } }),
      LinkPreview,
    ],
    content: initialHTML || "",
    editorProps: {
      attributes: { class: "rte-surface" },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length) {
          event.preventDefault();
          handleImageFiles(view, files, null);
          return true;
        }
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (isBareUrl(text)) {
          event.preventDefault();
          handleBareUrl(view, text.trim());
          return true;
        }
        return false;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
        const coords = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY });
        if (files.length) {
          event.preventDefault();
          handleImageFiles(view, files, coords?.pos ?? null);
          return true;
        }
        const uri = (dt?.getData("text/uri-list") || dt?.getData("text/plain") || "").trim();
        if (isBareUrl(uri)) {
          event.preventDefault();
          handleBareUrl(view, uri, coords?.pos ?? null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="rte min-h-[220px]" />;
  return (
    <div className="rte">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => force();
    editor.on("transaction", h);
    editor.on("selectionUpdate", h);
    return () => {
      editor.off("transaction", h);
      editor.off("selectionUpdate", h);
    };
  }, [editor]);

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    files.forEach(async (f) => {
      const url = await uploadImage(f);
      if (url) editor.chain().focus().setImage({ src: url }).run();
    });
    e.target.value = "";
  };

  const btn = (active: boolean) =>
    `px-2 py-1 rounded-md text-[13px] font-mono transition-colors ${
      active ? "bg-selected text-accent" : "text-ink-dim hover:text-ink hover:bg-card-2"
    }`;

  return (
    <div className="rte-toolbar">
      <button type="button" title="Bold" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </button>
      <button type="button" title="Italic" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </button>
      <button type="button" title="Underline" className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </button>
      <button type="button" title="Strikethrough" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </button>
      <span className="rte-sep" />
      <button type="button" title="Heading 1" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </button>
      <button type="button" title="Heading 2" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </button>
      <button type="button" title="Heading 3" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </button>
      <span className="rte-sep" />
      <button type="button" title="Bullet list" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </button>
      <button type="button" title="Numbered list" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </button>
      <button type="button" title="Quote" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        &ldquo;
      </button>
      <button type="button" title="Code" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {"</>"}
      </button>
      <span className="rte-sep" />
      <button type="button" title="Insert image" className={btn(false)} onClick={() => fileRef.current?.click()}>
        🖼
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickImage} />
      <span className="rte-sep" />
      <button type="button" title="Undo" className={btn(false)} onClick={() => editor.chain().focus().undo().run()}>
        ↺
      </button>
      <button type="button" title="Redo" className={btn(false)} onClick={() => editor.chain().focus().redo().run()}>
        ↻
      </button>
    </div>
  );
}

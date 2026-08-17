"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ReactRenderer } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import { searchEntitiesAction } from "@/app/mentions/actions";
import { ENTITY_META, type EntityCard } from "@/lib/entities";

type ListProps = { items: EntityCard[]; command: (attrs: { id: string; label: string }) => void };

const MentionList = forwardRef<{ onKeyDown: (x: { event: KeyboardEvent }) => boolean }, ListProps>(function MentionList({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  const select = (i: number) => {
    const item = items[i];
    if (item) command({ id: `${item.type}:${item.id}`, label: item.title });
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        select(index);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return <div className="mention-popup"><div className="px-2 py-1.5 text-xs text-ink-faint">No matches</div></div>;

  return (
    <div className="mention-popup">
      {items.map((item, i) => (
        <button
          key={`${item.type}:${item.id}`}
          type="button"
          onMouseEnter={() => setIndex(i)}
          onClick={() => select(i)}
          className={`w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${i === index ? "bg-surface-2" : ""}`}
        >
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: ENTITY_META[item.type].color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-ink">{item.title}</span>
            {item.subtitle && <span className="block truncate text-[11px] text-ink-faint">{item.subtitle}</span>}
          </span>
          <span className="label text-[9px] shrink-0">{ENTITY_META[item.type].label}</span>
        </button>
      ))}
    </div>
  );
});

function place(el: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  if (!clientRect) return;
  const rect = clientRect();
  if (!rect) return;
  el.style.position = "absolute";
  el.style.left = `${rect.left + window.scrollX}px`;
  el.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

// the configured inline @-mention extension used by RichEditor
export const InlineMention = Mention.configure({
  HTMLAttributes: { class: "rte-mention" },
  suggestion: {
    char: "@",
    items: async ({ query }: { query: string }) => searchEntitiesAction(query),
    render: () => {
      let component: ReactRenderer | null = null;
      let el: HTMLElement | null = null;
      return {
        onStart: (props: { editor: unknown; clientRect?: (() => DOMRect | null) | null }) => {
          component = new ReactRenderer(MentionList, { props, editor: props.editor as never });
          el = document.createElement("div");
          el.style.zIndex = "60";
          document.body.appendChild(el);
          el.appendChild(component.element);
          place(el, props.clientRect);
        },
        onUpdate: (props: { clientRect?: (() => DOMRect | null) | null }) => {
          component?.updateProps(props);
          if (el) place(el, props.clientRect);
        },
        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === "Escape") {
            el?.remove();
            el = null;
            return true;
          }
          return (component?.ref as { onKeyDown?: (p: { event: KeyboardEvent }) => boolean } | null)?.onKeyDown?.(props) ?? false;
        },
        onExit: () => {
          el?.remove();
          el = null;
          component?.destroy();
          component = null;
        },
      };
    },
  },
});

import { getUnifiedList } from "@/lib/list";
import CommandList from "@/components/inbox/command-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const list = await getUnifiedList();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Inbox</div>
        <h1 className="display text-4xl mt-2">One list</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          Capture anything, then move it: commit it to a task, schedule it, park it, or let it go. One place for the whole loop — nothing lives in two lists.
        </p>
      </header>
      <CommandList initial={list} />
    </div>
  );
}

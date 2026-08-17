import { listDecisions } from "@/lib/decisions";
import DecisionsBoard from "@/components/decisions/decisions-board";

export const dynamic = "force-dynamic";

export default async function DecisionsPage() {
  const decisions = await listDecisions();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Decisions</div>
        <h1 className="display text-4xl mt-2">Decided</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          What you chose, and why. When you catch yourself re-opening a settled question with no new information — this is the receipt.
        </p>
      </header>
      <DecisionsBoard initial={decisions} />
    </div>
  );
}

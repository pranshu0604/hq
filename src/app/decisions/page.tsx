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
          One card per situation — what you chose and why. When it comes back around, Revise it: the new call is saved on top, the old ones kept underneath, so you always see how your thinking on that exact situation has moved.
        </p>
      </header>
      <DecisionsBoard initial={decisions} />
    </div>
  );
}

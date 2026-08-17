import { listObservations, MANUAL_PROMPTS } from "@/lib/observations";
import ManualBoard from "@/components/manual/manual-board";

export const dynamic = "force-dynamic";

export default async function ManualPage() {
  const observations = await listObservations();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Operating manual</div>
        <h1 className="display text-4xl mt-2">How I work best</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">Observations, not diagnoses. The patterns worth designing your days around — added as you notice them.</p>
      </header>
      <ManualBoard initial={observations} prompts={MANUAL_PROMPTS} />
    </div>
  );
}

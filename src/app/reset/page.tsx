import ResetFlow from "@/components/reset/reset-flow";

export const dynamic = "force-dynamic";

export default function ResetPage() {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-8 py-20 reveal">
      <header className="mb-10">
        <div className="eyebrow">HQ · Reset</div>
        <h1 className="display text-4xl mt-2">Reset</h1>
        <p className="mt-3 text-[15px] text-ink-dim">Everything can wait five minutes. Do these, then one small thing.</p>
      </header>
      <ResetFlow />
    </div>
  );
}

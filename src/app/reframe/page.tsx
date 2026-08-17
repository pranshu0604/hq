import { listSocialChecks } from "@/lib/social-check";
import ReframeBoard from "@/components/reframe/reframe-board";

export const dynamic = "force-dynamic";

export default async function ReframePage() {
  const checks = await listSocialChecks();
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Reality check</div>
        <h1 className="display text-4xl mt-2">Was that actually a problem?</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          Something landed wrong. Separate what happened from what you read into it, weigh it once, and decide — instead of looping on it all evening.
        </p>
      </header>
      <ReframeBoard initial={checks} />
    </div>
  );
}

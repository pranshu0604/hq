import { listHandbooks } from "@/lib/handbooks";
import HandbooksBoard from "@/components/handbooks/handbooks-board";

export const dynamic = "force-dynamic";

export default async function HandbooksPage() {
  const handbooks = await listHandbooks();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Handbooks</div>
        <h1 className="display text-4xl mt-2">Handbooks</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          The self-contained HTML documents you&apos;ve poured research into — kept in HQ so they&apos;re always one tap away. Upload them, then open them rendered in any browser.
        </p>
      </header>
      <HandbooksBoard initial={handbooks} />
    </div>
  );
}

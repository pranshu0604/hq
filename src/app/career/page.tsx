import { getCareerProfile } from "@/lib/career";
import CareerForm from "@/components/career/career-form";

export const dynamic = "force-dynamic";

export default async function CareerPage() {
  const profile = await getCareerProfile();
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 lg:px-12 py-12 reveal">
      <header className="mb-8">
        <div className="eyebrow">HQ · Career profile</div>
        <h1 className="display text-4xl mt-2">What the autofill fills from</h1>
        <p className="mt-3 text-[15px] text-ink-dim max-w-xl">
          One source of truth for job applications. The browser extension reads this — plus the job description on the
          page — to fill forms. Keep the free-text <span className="text-ink">pitch</span> sharp; it drives the
          &ldquo;why you / cover letter&rdquo; answers.
        </p>
      </header>
      <CareerForm initial={profile} />
    </div>
  );
}

// Streams instantly while a dynamic page's server data resolves — so a slow load
// (e.g. the remote Turso DB on the hosted build) shows a skeleton, never a blank void.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-12 py-12">
      <div className="animate-pulse">
        {/* header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-5">
            <div className="h-3 w-40 rounded bg-card-2" />
            <div className="h-3 w-16 rounded bg-card-2" />
          </div>
          <div className="h-10 w-72 max-w-full rounded bg-card-2" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-card-2/70" />
          <div className="mt-2 h-4 w-2/3 max-w-md rounded bg-card-2/70" />
        </div>

        {/* stacked hero cards */}
        <div className="space-y-4 mb-4">
          <div className="h-24 rounded-xl border border-line bg-card" />
          <div className="h-20 rounded-xl border border-line bg-card" />
          <div className="h-14 rounded-xl border border-line bg-card" />
        </div>

        {/* asymmetric grid */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="h-40 rounded-xl border border-line bg-card" />
            <div className="h-52 rounded-xl border border-line bg-card" />
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="h-32 rounded-xl border border-line bg-card" />
            <div className="h-40 rounded-xl border border-line bg-card" />
            <div className="h-28 rounded-xl border border-line bg-card" />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 text-ink-faint text-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
          Loading your HQ…
        </div>
      </div>
    </div>
  );
}

// Tiny in-process stale-while-revalidate cache. The Mac's Next server is a single
// long-lived process (PM2), so a module-level Map persists across requests. Used
// to keep the expensive, slow-changing aggregates (gamification, profile, health
// rollups) instant when the DB is remote (Turso) — reads return the last value
// immediately and refresh in the background. Live data (NOW, todos) is NOT cached.
type Entry<T> = { at: number; val: T; refreshing: boolean };

const store = new Map<string, Entry<unknown>>();

// only worth caching when the DB is remote (Turso); on the local file DB it's
// already instant, so stay fresh and skip the cache entirely.
const REMOTE = !!process.env.TURSO_DATABASE_URL;

/** return cached value instantly; refresh in the background once it's older than ttlMs */
export async function swr<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  if (!REMOTE) return fn(); // local: always fresh, no staleness
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit) {
    if (Date.now() - hit.at >= ttlMs && !hit.refreshing) {
      hit.refreshing = true;
      fn()
        .then((val) => store.set(key, { at: Date.now(), val, refreshing: false }))
        .catch(() => {
          hit.refreshing = false; // keep the stale value, try again next time
        });
    }
    return hit.val;
  }
  // cold: must wait once (e.g. right after a server restart)
  const val = await fn();
  store.set(key, { at: Date.now(), val, refreshing: false });
  return val;
}

/** drop cached entries (all, or those whose key starts with prefix) after a write */
export function bust(prefix?: string): void {
  if (!prefix) return void store.clear();
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

// client helpers for the rich editor: upload an image, unfurl a link's OG data.

export async function uploadImage(file: File): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

export type Unfurled = { url: string; title: string; description: string; image: string; siteName: string };

export async function unfurl(url: string): Promise<Unfurled | null> {
  try {
    const res = await fetch(`/api/unfurl?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as Unfurled;
    if (!data.image && !data.title) return null; // nothing worth showing
    return data;
  } catch {
    return null;
  }
}

export function isBareUrl(text: string): boolean {
  const t = text.trim();
  return /^https?:\/\/\S+$/i.test(t) && !/\s/.test(t);
}

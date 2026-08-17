import { NextResponse } from "next/server";

export const runtime = "nodejs";

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function meta(html: string, prop: string) {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  return decode(html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? "");
}

// fetch a URL's Open Graph metadata for a link-preview card
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target || !/^https?:\/\//i.test(target)) return NextResponse.json({ error: "bad url" }, { status: 400 });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HQ-unfurl/1.0; +local)", Accept: "text/html,*/*" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const html = (await res.text()).slice(0, 600_000);

    let image = meta(html, "og:image") || meta(html, "twitter:image");
    const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "");
    const description = meta(html, "og:description") || meta(html, "description") || meta(html, "twitter:description");
    const siteName = meta(html, "og:site_name");

    // resolve protocol-relative / root-relative image urls
    if (image.startsWith("//")) image = "https:" + image;
    else if (image.startsWith("/")) {
      try {
        image = new URL(image, target).href;
      } catch {}
    }

    return NextResponse.json({ url: target, title, description, image, siteName });
  } catch {
    return NextResponse.json({ url: target, title: "", description: "", image: "", siteName: "" });
  }
}

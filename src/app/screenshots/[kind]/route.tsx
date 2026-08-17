import { ImageResponse } from "next/og";

export const runtime = "nodejs";

// promo screenshots for the PWA install dialog (richer install UI).
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const wide = kind !== "narrow";
  const width = wide ? 1280 : 720;
  const height = wide ? 720 : 1280;
  const tile = wide ? 132 : 148;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f1115",
          color: "#f2f0eb",
          fontFamily: "sans-serif",
          gap: 28,
          padding: 60,
        }}
      >
        <div
          style={{
            width: tile,
            height: tile,
            borderRadius: Math.round(tile * 0.22),
            background: "linear-gradient(150deg, #dc9a58, #b77932)",
            color: "#2a1608",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(tile * 0.46),
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          HQ
        </div>
        <div style={{ fontSize: wide ? 58 : 52, fontWeight: 800, letterSpacing: -1.5 }}>Your personal HQ</div>
        <div style={{ fontSize: wide ? 26 : 22, color: "#aeb4bf", textAlign: "center", maxWidth: wide ? 820 : 560, lineHeight: 1.5 }}>
          Applications · Work · Reflections · Notes · People · Gym — one command center for your whole life.
        </div>
      </div>
    ),
    { width, height }
  );
}

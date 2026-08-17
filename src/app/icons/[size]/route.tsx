import { ImageResponse } from "next/og";
import { hqIcon } from "@/lib/app-icon";

// PNG app icons for the web manifest — /icons/192, /icons/512, /icons/512?maskable=1
export async function GET(req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const n = Math.min(1024, Math.max(48, parseInt(size, 10) || 512));
  const maskable = new URL(req.url).searchParams.has("maskable");
  return new ImageResponse(hqIcon(n, maskable), { width: n, height: n });
}

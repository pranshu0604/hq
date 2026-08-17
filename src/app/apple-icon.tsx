import { ImageResponse } from "next/og";
import { hqIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(hqIcon(180), { ...size });
}

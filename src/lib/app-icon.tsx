// the HQ app-icon tile, rendered to PNG via next/og for the manifest + apple-touch.
// maskable variant fills the square edge-to-edge and keeps "HQ" inside the safe zone.
export function hqIcon(size: number, maskable = false) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(150deg, #dc9a58 0%, #b77932 100%)",
        color: "#2a1608",
        fontSize: Math.round(size * (maskable ? 0.34 : 0.44)),
        fontWeight: 800,
        letterSpacing: Math.round(-size * 0.02),
        borderRadius: maskable ? 0 : Math.round(size * 0.22),
        fontFamily: "sans-serif",
      }}
    >
      HQ
    </div>
  );
}

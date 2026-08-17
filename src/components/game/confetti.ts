import confetti from "canvas-confetti";

const GOLD = ["#b77932", "#d08a3f", "#e6a163", "#f0c483", "#f4f1ea"];

export function burst(intensity: "small" | "big" | "epic" = "small") {
  const base = { colors: GOLD, disableForReducedMotion: true, zIndex: 9999, scalar: 0.9 } as const;

  if (intensity === "small") {
    confetti({ ...base, particleCount: 55, spread: 60, startVelocity: 32, origin: { y: 0.75 } });
    return;
  }
  if (intensity === "big") {
    confetti({ ...base, particleCount: 130, spread: 95, startVelocity: 45, origin: { y: 0.65 } });
    confetti({ ...base, particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } });
    confetti({ ...base, particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } });
    return;
  }
  // epic — a short firework barrage for offers
  const end = Date.now() + 900;
  (function frame() {
    confetti({ ...base, particleCount: 6, angle: 60, spread: 65, startVelocity: 55, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 6, angle: 120, spread: 65, startVelocity: 55, origin: { x: 1, y: 0.7 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

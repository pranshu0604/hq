export type Toast = { id: number; emoji: string; title: string; body?: string };

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function addToast(t: Omit<Toast, "id">) {
  const id = ++seq;
  toasts = [...toasts, { ...t, id }];
  emit();
  setTimeout(() => removeToast(id), 5200);
}

export function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return toasts;
}

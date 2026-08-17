import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hq@localhost";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// send a notification to every stored subscription; prune ones that are gone (410/404)
export async function sendPush(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany();
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
        sent++;
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed++;
        }
      }
    })
  );
  return { sent, removed };
}

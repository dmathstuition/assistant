import webpush from "web-push";

// Web Push (VAPID) sender. Keys come from env:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY  — generate with `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                         — a mailto: or https: contact URL
// The public key is also exposed to the browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY
// so it can subscribe. If unset, push simply no-ops.

let configured = false;

function ensureConfigured() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:notifications@d-maths.app",
      publicKey,
      privateKey,
    );
    configured = true;
  }
  return true;
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string };

// Send one push. `gone` is true when the subscription is expired/unsubscribed
// (404/410) and the caller should delete it from the database.
export async function sendPush(
  sub: PushSub,
  payload: PushPayload,
): Promise<{ ok: boolean; gone: boolean }> {
  if (!ensureConfigured()) return { ok: false, gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, gone: false };
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return { ok: false, gone: code === 404 || code === 410 };
  }
}

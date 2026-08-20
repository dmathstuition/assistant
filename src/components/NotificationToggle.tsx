"use client";

import { useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";

// Enable/disable Web Push on this device. Subscribes through the already-
// registered service worker and stores the subscription server-side so the
// reminder cron can push to this phone even when the app is closed.
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function NotificationToggle() {
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setOn(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    setMsg("");
    try {
      if (!VAPID) throw new Error("Push isn't configured yet (missing VAPID key).");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notifications were blocked.");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("Couldn't save the subscription.");
      setOn(true);
      setMsg("Notifications on ✓");
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Could not enable notifications.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setMsg("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setOn(false);
      setMsg("Notifications off.");
    } catch {
      setMsg("Could not turn off notifications.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-muted">
        <BellIcon className="text-base text-brand-accent" />
        Push notifications
      </div>
      {!supported ? (
        <p className="text-sm text-brand-muted">
          This browser doesn&apos;t support push. On iPhone, install the app to your
          Home Screen first, then enable notifications from the installed app.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-brand-muted">
            Get reminders and budget alerts as pop-ups on this device — even when the
            app is closed.
          </p>
          <button
            type="button"
            onClick={on ? disable : enable}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
              on ? "btn-ghost text-brand-fg" : "btn-accent text-white"
            }`}
          >
            {busy ? "…" : on ? "Turn off" : "Enable notifications"}
          </button>
        </>
      )}
      {msg && <p className="mt-3 text-sm text-brand-muted">{msg}</p>}
    </div>
  );
}

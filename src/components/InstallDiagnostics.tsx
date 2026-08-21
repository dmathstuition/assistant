"use client";

import { useEffect, useState } from "react";

type Check = { label: string; ok: boolean | null; hint: string };

// A phone-friendly readout of the browser's PWA-install preconditions, so it's
// clear *why* an "Install" prompt isn't appearing without needing desktop
// DevTools. Purely diagnostic — it changes nothing.
export default function InstallDiagnostics() {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [env, setEnv] = useState<{ browser: string; ua: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const w = window as unknown as { __bipEvent?: unknown };
      const results: Check[] = [];

      // Identify the browser/engine — a real install (WebAPK, own app icon,
      // shows in the app drawer) needs Chrome or Samsung Internet. In-app
      // browsers and some Chrome clones can only make a home-screen shortcut.
      const ua = navigator.userAgent;
      const isWebView = /(FBAN|FBAV|Instagram|Telegram|Line\/|MicroMessenger|; wv\))/i.test(ua);
      let browser = "Other browser";
      if (isWebView) browser = "In-app browser (can't install apps)";
      else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
      else if (/EdgA?\//i.test(ua)) browser = "Microsoft Edge";
      else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
      else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
      else if (/CriOS/i.test(ua)) browser = "Chrome on iPhone (use Safari instead)";
      else if (/Chrome\//i.test(ua)) browser = "Chrome";
      setEnv({ browser, ua });

      results.push({
        label: "Supported browser (Chrome)",
        ok: browser === "Chrome" || browser === "Samsung Internet",
        hint: isWebView
          ? "You opened this inside another app. Tap ⋮ → Open in Chrome, then install from there."
          : "Open the site in Chrome (Android) to get a real app install.",
      });

      results.push({
        label: "Secure connection (HTTPS)",
        ok: window.location.protocol === "https:",
        hint: "Install only works over https.",
      });

      const manifestLinked = !!document.querySelector('link[rel="manifest"]');
      let manifestOk: boolean | null = manifestLinked ? false : null;
      if (manifestLinked) {
        try {
          const r = await fetch("/manifest.webmanifest", { cache: "no-store" });
          const j = await r.json();
          manifestOk = r.ok && Array.isArray(j.icons) && j.icons.length > 0;
        } catch {
          manifestOk = false;
        }
      }
      results.push({
        label: "App manifest loads",
        ok: manifestLinked ? manifestOk : false,
        hint: "The site must serve /manifest.webmanifest with icons.",
      });

      let swRegistered: boolean | null = null;
      let swControlling = false;
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          swRegistered = !!reg;
          swControlling = !!navigator.serviceWorker.controller;
        } catch {
          swRegistered = false;
        }
      } else {
        swRegistered = false;
      }
      results.push({
        label: "Service worker registered",
        ok: swRegistered,
        hint: "Reload the page once if this is off — it registers on first visit.",
      });
      results.push({
        label: "Service worker controlling page",
        ok: swControlling,
        hint: "Turns on after one reload following the first visit.",
      });

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      results.push({
        label: "Install prompt captured",
        ok: standalone ? true : !!w.__bipEvent,
        hint: standalone
          ? "Already running as an installed app."
          : "If everything above is ✓ but this is ✗, use the browser menu → Install app (Android), or Safari Share → Add to Home Screen (iPhone).",
      });

      if (!cancelled) setChecks(results);
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-brand-accent hover:underline"
      >
        {open ? "Hide" : "Why can’t I install?"}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-brand-border bg-brand-fg/5 p-3 text-xs">
          {env && (
            <div className="mb-1 border-b border-brand-border pb-2">
              <div className="font-medium">Browser: {env.browser}</div>
              <div className="mt-1 break-all text-[10px] text-brand-muted">{env.ua}</div>
            </div>
          )}
          {checks.length === 0 ? (
            <p className="text-brand-muted">Checking…</p>
          ) : (
            checks.map((c) => (
              <div key={c.label}>
                <div className="flex items-center gap-2">
                  <span aria-hidden className={c.ok ? "text-green-400" : "text-red-400"}>
                    {c.ok === null ? "—" : c.ok ? "✓" : "✗"}
                  </span>
                  <span className="font-medium">{c.label}</span>
                </div>
                {!c.ok && <p className="ml-6 text-brand-muted">{c.hint}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

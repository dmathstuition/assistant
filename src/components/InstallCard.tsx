"use client";

import { useEffect, useState } from "react";
import { DownloadAppIcon } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// A visible "install as an app" card. On Android/Chrome it shows a real install
// button (beforeinstallprompt). On iOS Safari — which has no install API — it
// shows the Add-to-Home-Screen steps. The whole card disappears once the app is
// already running installed (standalone display mode).
export default function InstallCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes navigator.standalone
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Hide entirely once installed or after a successful in-card install.
  if (installed || done) return null;

  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-start gap-4">
        <span className="btn-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl text-white">
          <DownloadAppIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Install D-Maths as an app</div>
          <p className="mt-1 text-sm text-brand-muted">
            Add it to your home screen to open it like any other app — full-screen,
            offline-ready, with notifications.
          </p>

          {isIOS ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-brand-muted">
              <li>
                Tap the <b className="text-white">Share</b> icon in Safari.
              </li>
              <li>
                Choose <b className="text-white">Add to Home Screen</b>.
              </li>
              <li>
                Tap <b className="text-white">Add</b> — D-Maths appears on your home
                screen.
              </li>
            </ol>
          ) : deferred ? (
            <button
              type="button"
              onClick={async () => {
                await deferred.prompt();
                const choice = await deferred.userChoice;
                setDeferred(null);
                if (choice.outcome === "accepted") setDone(true);
              }}
              className="btn-accent mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            >
              <DownloadAppIcon className="text-base" />
              Install app
            </button>
          ) : (
            <p className="mt-3 text-sm text-brand-muted">
              In your browser menu (⋮), choose{" "}
              <b className="text-white">Install app</b> or{" "}
              <b className="text-white">Add to Home screen</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

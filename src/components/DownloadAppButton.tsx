"use client";

import { useEffect, useState } from "react";
import { DownloadAppIcon } from "@/components/icons";
import InstallDiagnostics from "@/components/InstallDiagnostics";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// A prominent, always-visible "Download app" button for the dashboard.
// If the browser has offered a native install (Chrome/Android), tapping it
// installs immediately. Otherwise it opens clear per-platform steps — because
// on iPhone (Safari) and some Android browsers the install is a manual menu
// action, not a programmatic prompt.
export default function DownloadAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const w = window as unknown as { __bipEvent?: BeforeInstallPromptEvent | null };
    const adopt = () => {
      if (w.__bipEvent) setDeferred(w.__bipEvent);
    };
    adopt();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      w.__bipEvent = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      w.__bipEvent = null;
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("bip-ready", adopt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("bip-ready", adopt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function onClick() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      (window as unknown as { __bipEvent?: unknown }).__bipEvent = null;
      setDeferred(null);
      return;
    }
    setShowSteps((v) => !v);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="btn-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl text-white">
          <DownloadAppIcon />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Get the app</div>
          <p className="text-xs text-brand-muted">
            Install D-Maths to your phone — full-screen, offline-ready, with its own icon.
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="btn-accent shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          {deferred ? "Install" : "Download app"}
        </button>
      </div>

      {showSteps && !deferred && (
        <div className="mt-3 rounded-lg border border-brand-border bg-brand-fg/5 p-3 text-xs">
          {isIOS ? (
            <ol className="list-decimal space-y-1 pl-4 text-brand-muted">
              <li>
                Open this site in <b className="text-brand-fg">Safari</b> (not Chrome or an
                in-app browser).
              </li>
              <li>
                Tap <b className="text-brand-fg">Share</b> (the square with an up-arrow).
              </li>
              <li>
                Choose <b className="text-brand-fg">Add to Home Screen</b> →{" "}
                <b className="text-brand-fg">Add</b>.
              </li>
              <li>Open the new icon — it runs full-screen like a normal app.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-brand-muted">
              <li>
                Open this site in the <b className="text-brand-fg">Chrome</b> app (a real app
                install needs Chrome — in-app browsers only make a shortcut).
              </li>
              <li>
                Tap the <b className="text-brand-fg">⋮</b> menu (top-right).
              </li>
              <li>
                Choose <b className="text-brand-fg">Install app</b> (or{" "}
                <b className="text-brand-fg">Add to Home screen</b>).
              </li>
              <li>Delete any old D-Maths icon first so the new app takes over.</li>
            </ol>
          )}
        </div>
      )}

      <InstallDiagnostics />
    </div>
  );
}

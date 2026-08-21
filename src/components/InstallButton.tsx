"use client";

import { useEffect, useState } from "react";
import { DownloadAppIcon } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Shows an "Install app" button once Chrome/Android fires beforeinstallprompt,
// and triggers the native install dialog. Hidden when already installed or on
// browsers (iOS Safari) that don't support programmatic install — there the
// user adds it via Share → Add to Home Screen.
export default function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return; // already installed
    const w = window as unknown as { __bipEvent?: BeforeInstallPromptEvent | null };
    // The event may have already fired (and been stashed) before this mounted.
    const adopt = () => {
      if (w.__bipEvent) {
        setDeferred(w.__bipEvent);
        setHidden(false);
      }
    };
    adopt();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      w.__bipEvent = e as BeforeInstallPromptEvent;
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      w.__bipEvent = null;
      setDeferred(null);
      setHidden(true);
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

  if (hidden || !deferred) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        await deferred.userChoice;
        (window as unknown as { __bipEvent?: unknown }).__bipEvent = null;
        setDeferred(null);
        setHidden(true);
      }}
      className="btn-accent flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
    >
      <DownloadAppIcon className="text-base" />
      Install
    </button>
  );
}

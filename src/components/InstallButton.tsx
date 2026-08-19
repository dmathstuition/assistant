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
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
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

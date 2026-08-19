"use client";

import { useEffect } from "react";

// Registers the service worker once, on the client, so the app is installable
// and works offline. Silent no-op where service workers aren't supported.
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

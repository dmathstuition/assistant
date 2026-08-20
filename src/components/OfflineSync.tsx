"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushQueue } from "@/lib/offlineQueue";
import { useToast } from "@/components/ToastProvider";

// Flushes the offline queue on load and whenever the device comes back online.
export default function OfflineSync() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    async function sync() {
      if (!navigator.onLine) return;
      try {
        const n = await flushQueue();
        if (!cancelled && n > 0) {
          toast(`Synced ${n} offline ${n === 1 ? "entry" : "entries"} ✓`);
          router.refresh();
        }
      } catch {
        /* still offline or a transient error — try again next time */
      }
    }
    sync();
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
    };
  }, [router, toast]);

  return null;
}

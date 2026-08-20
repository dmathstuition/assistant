// A tiny offline queue held in localStorage. When the device is offline, quick
// entries are stashed here and flushed to /api/offline once it's back online.
export type QueuedItem = {
  type: "expense" | "income" | "task";
  data: Record<string, string>;
  ts: number;
};

const KEY = "dmaths_offline_queue";

export function getQueue(): QueuedItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as QueuedItem[];
  } catch {
    return [];
  }
}

function setQueue(q: QueuedItem[]) {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueue(item: Omit<QueuedItem, "ts">) {
  const q = getQueue();
  q.push({ ...item, ts: Date.now() });
  setQueue(q);
}

export function queueCount() {
  return getQueue().length;
}

// Send queued items to the server. Returns how many were saved. Removes only the
// items that were in the queue when the flush started, so anything added during
// the request survives.
export async function flushQueue(): Promise<number> {
  const q = getQueue();
  if (q.length === 0) return 0;
  const res = await fetch("/api/offline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: q }),
  });
  if (!res.ok) throw new Error("sync failed");
  const d = (await res.json()) as { saved?: number };
  setQueue(getQueue().slice(q.length));
  return d.saved ?? q.length;
}

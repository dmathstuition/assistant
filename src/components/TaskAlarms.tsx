"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon, ClockIcon } from "@/components/icons";

// In-app task alarms. While the app is open it polls today's timed tasks and,
// for each, fires a warning 10 minutes before the due time and an alarm at the
// due time — a beep, a device notification (if allowed), a vibration, and an
// on-screen banner. (Alarms while the app is fully closed would need scheduled
// server push; this covers the app being open or in the background tab.)
const WARN_MS = 10 * 60 * 1000;
const POLL_MS = 60 * 1000;

type Feed = { id: string; title: string; due_time: string | null };
type Fired = { key: string; kind: "warn" | "due"; title: string; at: number };

export default function TaskAlarms() {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const firedKeys = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);
  const [banner, setBanner] = useState<{ kind: "warn" | "due"; title: string } | null>(
    null,
  );

  // A short triple-beep using WebAudio (created after a user gesture so it isn't
  // blocked by autoplay policy).
  const beep = useCallback(() => {
    const ctx = audioCtx.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    [0, 0.6, 1.2].forEach((offset) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      const t = ctx.currentTime + offset;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.start(t);
      o.stop(t + 0.5);
    });
  }, []);

  const fire = useCallback(
    (item: Fired) => {
      if (firedKeys.current.has(item.key)) return;
      firedKeys.current.add(item.key);

      const heading =
        item.kind === "warn" ? "Task in 10 minutes" : "Task due now";
      beep();
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(heading, { body: item.title, icon: "/icon-192.png" });
        } catch {
          /* some browsers only allow notifications from the SW; banner still shows */
        }
      }
      setBanner({ kind: item.kind, title: item.title });
    },
    [beep],
  );

  const schedule = useCallback(
    (tasks: Feed[]) => {
      // Clear existing timers and re-plan from the current feed.
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();

      const now = Date.now();
      const todayStr = new Date().toISOString().slice(0, 10); // local date components below
      void todayStr;

      for (const task of tasks) {
        if (!task.due_time) continue;
        const [h, m] = task.due_time.split(":").map(Number);
        const due = new Date();
        due.setHours(h, m ?? 0, 0, 0);
        const dueMs = due.getTime();

        const plan = (kind: "warn" | "due", at: number) => {
          const key = `${task.id}:${kind}`;
          if (firedKeys.current.has(key)) return;
          const delay = at - now;
          if (delay <= 0) return; // already passed today
          const timer = setTimeout(
            () => fire({ key, kind, title: task.title, at }),
            delay,
          );
          timers.current.set(key, timer);
        };

        plan("warn", dueMs - WARN_MS);
        plan("due", dueMs);
      }
    },
    [fire],
  );

  const refresh = useCallback(async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/tasks/today?date=${date}`, { cache: "no-store" });
      if (!res.ok) return;
      const { tasks } = (await res.json()) as { tasks: Feed[] };
      schedule(tasks);
    } catch {
      /* offline or signed out — try again next poll */
    }
  }, [schedule]);

  useEffect(() => {
    // Unlock audio on the first interaction so alarms can beep later.
    const unlock = () => {
      if (!audioCtx.current) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) audioCtx.current = new Ctor();
      }
      audioCtx.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { once: true });

    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const timersSnapshot = timers.current;
    return () => {
      window.removeEventListener("pointerdown", unlock);
      clearInterval(poll);
      for (const t of timersSnapshot.values()) clearTimeout(t);
    };
  }, [refresh]);

  if (!banner) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="card flex items-center gap-3 border-brand-accent/40 px-4 py-3 shadow-xl">
        <span className="text-xl text-brand-accent">
          {banner.kind === "warn" ? <ClockIcon /> : <BellIcon />}
        </span>
        <div className="text-sm">
          <div className="font-semibold">
            {banner.kind === "warn" ? "Due in 10 minutes" : "Task due now"}
          </div>
          <div className="text-brand-muted">{banner.title}</div>
        </div>
        <button
          type="button"
          onClick={() => setBanner(null)}
          className="btn-ghost ml-2 rounded-lg px-3 py-1.5 text-sm"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

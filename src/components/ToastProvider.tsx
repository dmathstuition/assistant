"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

// A tiny toast system with an "Undo" affordance. `undo()` shows a toast for 5s
// and only runs `commit` (e.g. the real server delete) once it expires — tapping
// Undo cancels it and runs `onUndo` (e.g. un-hide the row). Callers optimistically
// hide the item first, so deletes feel instant but stay reversible.
type Pending = {
  timer: ReturnType<typeof setTimeout>;
  commit: () => void | Promise<void>;
};

type ToastCtx = {
  undo: (
    message: string,
    commit: () => void | Promise<void>,
    onUndo?: () => void,
  ) => void;
  toast: (message: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const pending = useRef<Pending | null>(null);
  const onUndoRef = useRef<(() => void) | null>(null);

  function flush() {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      void pending.current.commit();
      pending.current = null;
    }
    onUndoRef.current = null;
  }

  function undo(
    msg: string,
    commit: () => void | Promise<void>,
    onUndo?: () => void,
  ) {
    flush(); // commit any previous pending delete immediately
    onUndoRef.current = onUndo ?? null;
    const timer = setTimeout(() => {
      void commit();
      pending.current = null;
      onUndoRef.current = null;
      setMessage(null);
      setShowUndo(false);
    }, 5000);
    pending.current = { timer, commit };
    setMessage(msg);
    setShowUndo(true);
  }

  function toast(msg: string) {
    flush();
    setShowUndo(false);
    setMessage(msg);
    setTimeout(() => setMessage((m) => (m === msg ? null : m)), 3000);
  }

  function doUndo() {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
    onUndoRef.current?.();
    onUndoRef.current = null;
    setMessage(null);
    setShowUndo(false);
  }

  return (
    <Ctx.Provider value={{ undo, toast }}>
      {children}
      {message && (
        <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 sm:bottom-6">
          <div className="card flex items-center gap-3 px-4 py-2.5 text-sm shadow-xl">
            <span>{message}</span>
            {showUndo && (
              <button
                type="button"
                onClick={doUndo}
                className="font-semibold text-brand-accent hover:underline"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

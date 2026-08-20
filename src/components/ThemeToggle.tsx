"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

type Theme = "dark" | "light";

// Kept in sync with the anti-FOUC script in src/app/layout.tsx.
function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  // Keep the mobile status-bar / PWA chrome colour in step with the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#eef3fb" : "#0A1628");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* private mode — ignore */
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    apply(next);
    setTheme(next);
  }

  // Render a stable shell until mounted so the button doesn't flash the wrong icon.
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-label="Toggle theme"
      className="btn-ghost flex h-8 w-8 items-center justify-center rounded-lg text-base text-brand-muted hover:text-brand-fg"
    >
      {mounted && isLight ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

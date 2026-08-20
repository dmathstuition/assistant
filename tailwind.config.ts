import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables (see globals.css) so the whole palette
        // swaps between dark and light themes from one place.
        brand: {
          bg: "rgb(var(--brand-bg) / <alpha-value>)",
          card: "rgb(var(--brand-card) / <alpha-value>)",
          border: "rgb(var(--brand-border) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
          accent2: "rgb(var(--brand-accent2) / <alpha-value>)",
          muted: "rgb(var(--brand-muted) / <alpha-value>)",
          fg: "rgb(var(--brand-fg) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0A1628",       // D-Maths deep blue
          card: "#0f1f38",
          border: "#1c3050",
          accent: "#FF6B2B",   // D-Maths orange
          accent2: "#F97316",
          muted: "#93a4c3",
        },
      },
    },
  },
  plugins: [],
};
export default config;

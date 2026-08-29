// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crimson: {
          DEFAULT: "#DC2626",
          dark: "#7F1D1D",
          light: "#EF4444",
        },
        bone: "#E8E3D8",
        steel: "#8B8D93",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        "glow-crimson": "0 0 24px 2px rgba(220, 38, 38, 0.35)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

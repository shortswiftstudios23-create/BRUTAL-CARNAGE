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
        gold: {
          DEFAULT: "#D4A94E",
          dark: "#8A6D2F",
          light: "#E8C87A",
        },
        bone: "#E8E3D8",
        steel: "#8B8D93",
        panel: "hsl(var(--panel))",
        "panel-border": "hsl(var(--panel-border))",
      },
      fontFamily: {
        display: ["var(--font-bebas)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      letterSpacing: {
        widest2: "0.18em",
      },
      boxShadow: {
        "glow-crimson": "0 0 24px 2px rgba(220, 38, 38, 0.35)",
        "glow-gold": "0 0 20px 1px rgba(212, 169, 78, 0.3)",
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grain-fade": "linear-gradient(180deg, transparent, hsl(var(--background)))",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

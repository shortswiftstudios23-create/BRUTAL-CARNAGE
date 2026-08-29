// components/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

// Thin client wrapper so the root layout (a server component) can still
// mount next-themes, which needs to run on the client to read/write the
// `class` attribute before hydration (attribute="class" + suppressHydrationWarning
// on <html> in layout.tsx avoids the flash-of-wrong-theme).
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

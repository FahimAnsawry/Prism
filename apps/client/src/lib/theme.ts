// Light/dark theme. The `dark` class on <html> drives every color (see index.css); the inline
// script in index.html sets it before first paint, and <ThemeProvider> keeps it in sync after.
// Keep STORAGE_KEY and THEME_COLOR in step with that script.

import { createContext, useContext } from "react";

export type Theme = "light" | "dark";

export const STORAGE_KEY = "prism:theme";

/** Browser chrome color per theme: the page background (--color-canvas / .dark --background). */
const THEME_COLOR: Record<Theme, string> = { light: "#e9e9e9", dark: "#1d1c23" };

export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The theme the user picked, or null to follow the system. Storage can be unavailable. */
export function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not critical: the choice lasts for this visit only.
  }
}

export function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * Puts `theme` on the document. Transitions are paused for two frames so every control changes
 * color together instead of each easing on its own duration (index.css exempts the toggle).
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (root.classList.contains("dark") === (theme === "dark")) return;

  root.setAttribute("data-theme-switching", "");
  root.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.removeAttribute("data-theme-switching")),
  );
}

export interface ThemeContextValue {
  theme: Theme;
  /**
   * Flips the theme and remembers the choice. `origin` (viewport px) is where the circular
   * reveal starts; without it, or without View Transitions, the swap is instant.
   */
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside <ThemeProvider>");
  return context;
}

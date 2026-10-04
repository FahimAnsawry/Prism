import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { flushSync } from "react-dom";
import {
  applyTheme,
  DARK_QUERY,
  readStoredTheme,
  STORAGE_KEY,
  storeTheme,
  systemTheme,
  type Theme,
  ThemeContext,
} from "@/lib/theme";

const REVEAL_MS = 650;
const REVEAL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

function subscribeToSystem(onChange: () => void) {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Follows the system theme until the user picks one; the pick is remembered per browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState(readStoredTheme);
  const system = useSyncExternalStore(subscribeToSystem, systemTheme);
  const theme = stored ?? system;

  useLayoutEffect(() => applyTheme(theme), [theme]);

  // A choice made in another tab applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setStored(readStoredTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: Theme = theme === "dark" ? "light" : "dark";
      storeTheme(next);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!origin || reduceMotion || !document.startViewTransition) {
        setStored(next);
        return;
      }

      // Snapshot the old theme, commit the new one synchronously, then grow a circle of the new
      // theme out from the toggle until it covers the farthest corner of the viewport.
      const transition = document.startViewTransition(() => flushSync(() => setStored(next)));
      transition.ready
        .then(() => {
          const radius = Math.hypot(
            Math.max(origin.x, window.innerWidth - origin.x),
            Math.max(origin.y, window.innerHeight - origin.y),
          );
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${origin.x}px ${origin.y}px)`,
                `circle(${radius}px at ${origin.x}px ${origin.y}px)`,
              ],
            },
            {
              duration: REVEAL_MS,
              easing: REVEAL_EASE,
              pseudoElement: "::view-transition-new(root)",
            },
          );
        })
        .catch(() => {
          // The transition was skipped (e.g. the tab was hidden); the theme is already applied.
        });
    },
    [theme],
  );

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

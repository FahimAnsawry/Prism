import type { SortKey, ViewMode } from "./workspace-data";

// The dashboard's sort and view choice, kept in this browser between visits.

const STORAGE_KEY = "prism:dashboard";

export type DashboardPrefs = { sort: SortKey; view: ViewMode };

const DEFAULT_PREFS: DashboardPrefs = { sort: "edited", view: "grid" };

const SORTS: readonly SortKey[] = ["edited", "created", "name"];
const VIEWS: readonly ViewMode[] = ["grid", "list"];

/** The saved choice, or the defaults. Storage can be unavailable or hold an old shape. */
export function readDashboardPrefs(): DashboardPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<
      Record<keyof DashboardPrefs, unknown>
    >;
    return {
      sort: SORTS.find((s) => s === saved.sort) ?? DEFAULT_PREFS.sort,
      view: VIEWS.find((v) => v === saved.view) ?? DEFAULT_PREFS.view,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function storeDashboardPrefs(prefs: DashboardPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not critical: the choice lasts for this visit only.
  }
}

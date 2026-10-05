import type { BoardSummary, ProjectSummary, Workspace } from "@prism/shared";

export type WorkspaceItem =
  | ({ kind: "project" } & ProjectSummary)
  /** `projectName` is set when the board lives inside a project. */
  | ({ kind: "board"; projectName?: string } & BoardSummary);

export type Filter = "all" | "project" | "board";
export type SortKey = "edited" | "created" | "name";
export type ViewMode = "grid" | "list";

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "edited", label: "Last edited" },
  { id: "created", label: "Date created" },
  { id: "name", label: "Name" },
];

/**
 * What each filter lists. "All" is the top level: projects and the boards outside them.
 * "Whiteboards" is every board, so boards past a project card's three tiles stay reachable.
 */
export function itemsFor(workspace: Workspace, filter: Filter): WorkspaceItem[] {
  const projects = workspace.projects.map((p) => ({ kind: "project" as const, ...p }));
  if (filter === "project") return projects;

  const projectNames = new Map(workspace.projects.map((p) => [p.id, p.name]));
  const boards = workspace.boards
    .filter((b) => filter === "board" || b.projectId === null)
    .map((b) => ({
      kind: "board" as const,
      ...b,
      projectName: (b.projectId && projectNames.get(b.projectId)) || undefined,
    }));
  return filter === "board" ? boards : [...projects, ...boards];
}

export function matchesQuery(item: WorkspaceItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const project = item.kind === "board" ? item.projectName : undefined;
  return [item.name, item.description, project].some((text) => text?.toLowerCase().includes(q));
}

const byName = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/** Newest first for both dates; names A–Z, ignoring case. Ties fall back to the newest edit. */
export function sortItems(items: WorkspaceItem[], sort: SortKey) {
  const time = (iso: string) => Date.parse(iso);
  const byEdited = (a: WorkspaceItem, b: WorkspaceItem) => time(b.editedAt) - time(a.editedAt);
  return items.toSorted((a, b) => {
    if (sort === "name") return byName.compare(a.name, b.name) || byEdited(a, b);
    if (sort === "created") return time(b.createdAt) - time(a.createdAt) || byEdited(a, b);
    return byEdited(a, b);
  });
}

/** The date a card or row shows: the creation date when sorting by it, else the last edit. */
export function shownDate(item: WorkspaceItem, sort: SortKey) {
  return sort === "created"
    ? { label: "Created", iso: item.createdAt }
    : { label: "Edited", iso: item.editedAt };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const fullDateTime = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** "just now", "5m ago", "2h ago", "6d ago", then a date ("Mar 4", or "Mar 4, 2025" in past years). */
export function timeAgo(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const diff = Math.max(0, now - date.getTime());
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? shortDate.format(date)
    : fullDate.format(date);
}

/** The exact time, for a tooltip. */
export function exactTime(iso: string) {
  return fullDateTime.format(new Date(iso));
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "6 boards" for a project, "26 items" for a board. */
export function itemMeta(item: WorkspaceItem) {
  return item.kind === "project"
    ? plural(item.boardCount, "board")
    : plural(item.itemCount, "item");
}

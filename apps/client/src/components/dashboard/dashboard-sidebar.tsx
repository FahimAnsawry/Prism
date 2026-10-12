import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FolderKanban,
  PencilRuler,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  PlugZap,
  UsersRound,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { editorsQuery } from "@/lib/account";
import { cn } from "@/lib/utils";
import { ProjectLogo } from "./dashboard-parts";
import { toolForEditor } from "./ai-tools";
import { EditorLogo } from "./editor-logo";
import { sectionSearch, type Section } from "./workspace-data";

const NAV: { id: Section; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: "all", label: "All work", Icon: LayoutDashboard },
  { id: "projects", label: "Projects", Icon: FolderKanban },
  { id: "boards", label: "Whiteboards", Icon: PencilRuler },
  { id: "shared", label: "Shared with you", Icon: UsersRound },
];

export type SidebarProps = {
  /** The section to highlight; null on a page outside them (the profile). */
  section: Section | null;
  /** How many items each section lists, once the workspace has loaded. */
  counts: Record<Section, number> | undefined;
  projects: { id: string; name: string; boardCount: number }[];
  /** Opens a project's board list. Without it, a project links to the Projects page. */
  onOpenProject?: (id: string) => void;
  /** Without it, the "+" beside "Projects" is left out. */
  onNewProject?: () => void;
  /** Called after any choice, so the phone drawer can close. */
  onNavigate?: () => void;
  /** Icons only: the narrow rail of the desktop sidebar. */
  collapsed?: boolean;
};

const COLLAPSED_KEY = "prism:sidebar-collapsed";

/** Whether the desktop sidebar is folded to its icon rail; remembered in this browser. */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Blocked storage: the choice just does not outlive the page.
    }
  };
  return [collapsed, toggle] as const;
}

/** Labels fade instead of vanishing, so the sidebar's width change reads as one motion. */
const fade = "transition-opacity duration-200 ease-standard";

const projectRow =
  "flex h-9 w-full items-center gap-3 overflow-hidden px-3.5 text-left text-sm text-foreground transition-colors duration-150 ease-standard hover:bg-background";

function ProjectRowContent({
  project,
  collapsed,
}: {
  project: SidebarProps["projects"][number];
  collapsed?: boolean;
}) {
  return (
    <>
      <ProjectLogo projectId={project.id} />
      <span className={cn(fade, "min-w-0 flex-1 truncate", collapsed && "opacity-0")}>
        {project.name}
      </span>
      <span
        className={cn(fade, "font-mono text-2xs text-muted-foreground", collapsed && "opacity-0")}
      >
        {project.boardCount}
      </span>
    </>
  );
}

/** The sections and the user's projects: the desktop sidebar, and the top of the phone drawer. */
export function SidebarNav({
  section,
  counts,
  projects,
  onOpenProject,
  onNewProject,
  onNavigate,
  collapsed = false,
}: SidebarProps) {
  const activeIndex = NAV.findIndex(({ id }) => id === section);
  return (
    <>
      <nav aria-label="Dashboard">
        <ul className="relative flex flex-col gap-1">
          {/* One highlight that slides to the current section instead of each link switching. */}
          <li
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-10 bg-seafoam transition-[translate,opacity] duration-300 ease-standard dark:bg-seafoam/14",
              activeIndex < 0 && "opacity-0",
            )}
            style={{ translate: `0 ${Math.max(activeIndex, 0) * 2.75}rem` }}
          />
          {NAV.map(({ id, label, Icon }) => {
            const active = section === id;
            return (
              <li key={id}>
                <Link
                  to="/dashboard"
                  search={sectionSearch(id)}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "group/nav relative flex h-10 items-center gap-3 overflow-hidden px-3.5 text-sm transition-colors duration-200 ease-standard",
                    active
                      ? "font-bold text-slate dark:text-ink"
                      : "text-foreground hover:bg-background",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 shrink-0 transition-transform duration-200 ease-standard group-hover/nav:scale-110"
                  />
                  <span className={cn(fade, "min-w-0 flex-1 truncate", collapsed && "opacity-0")}>
                    {label}
                  </span>
                  {counts && (
                    <span
                      className={cn(
                        fade,
                        "font-mono text-2xs",
                        active ? "text-current" : "text-muted-foreground",
                        collapsed && "opacity-0",
                      )}
                    >
                      {counts[id]}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-5 border-t border-divider pt-5">
        <div
          className={cn(
            "flex h-8 items-center justify-between pr-1 pl-3.5",
            collapsed && "justify-center p-0",
          )}
        >
          {!collapsed && (
            <h2 className="font-mono text-3xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Projects
            </h2>
          )}
          {onNewProject && (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                onNewProject();
              }}
              aria-label="New project"
              title="New project"
              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-ink"
            >
              <Plus aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        {projects.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {projects.map((project) => (
              <li key={project.id}>
                {onOpenProject ? (
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate?.();
                      onOpenProject(project.id);
                    }}
                    aria-haspopup="dialog"
                    aria-label={collapsed ? project.name : undefined}
                    title={collapsed ? project.name : undefined}
                    className={projectRow}
                  >
                    <ProjectRowContent project={project} collapsed={collapsed} />
                  </button>
                ) : (
                  <Link
                    to="/dashboard"
                    search={sectionSearch("projects")}
                    onClick={onNavigate}
                    aria-label={collapsed ? project.name : undefined}
                    title={collapsed ? project.name : undefined}
                    className={projectRow}
                  >
                    <ProjectRowContent project={project} collapsed={collapsed} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          counts &&
          !collapsed && (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">No projects yet</p>
          )
        )}
      </div>
    </>
  );
}

/** One white tile with a connected tool's logo; the name is in the tooltip. */
function LogoTile({ name }: { name: string }) {
  return (
    <span
      title={name}
      className="flex size-9 shrink-0 items-center justify-center border border-divider bg-white"
    >
      <EditorLogo name={name} className="size-5" />
    </span>
  );
}

/**
 * The AI tools signed in to Prism, each with its logo and name (logos only on the narrow rail);
 * a hint to connect one when there are none.
 */
function EditorsCard({ onConnectAi, collapsed }: { onConnectAi: () => void; collapsed: boolean }) {
  const editors = useQuery(editorsQuery).data ?? [];
  // Two sign-ins of one tool (Claude and Claude Code, say) get one logo each, not two of a kind.
  const tools = [...new Map(editors.map((e) => [toolForEditor(e.name)?.id ?? e.name, e])).values()];
  const names = tools.map((tool) => tool.name).join(", ");

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onConnectAi}
        aria-label={tools.length ? `AI tools: ${names}` : "Connect AI tools"}
        title={tools.length ? names : "Connect AI tools"}
        key="rail"
        className="animate-fade-in mt-auto flex flex-col items-center gap-2 border border-divider bg-background p-1.5 transition-colors duration-150 ease-standard hover:border-input"
      >
        {tools.length ? (
          tools.slice(0, 3).map((tool) => <LogoTile key={tool.clientId} name={tool.name} />)
        ) : (
          <PlugZap aria-hidden="true" className="my-2 size-4 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onConnectAi}
      key="card"
      className="group animate-fade-in mt-auto border border-divider bg-background px-4 py-3.5 text-left transition-colors duration-150 ease-standard hover:border-input"
    >
      <span className="flex items-center gap-2 text-[13px] font-bold text-foreground">
        <span
          aria-hidden="true"
          className={cn("size-2 rounded-full", tools.length ? "bg-brand" : "bg-muted-foreground")}
        />
        AI tools
      </span>
      {tools.length ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          {tools.slice(0, 4).map((tool) => (
            <li key={tool.clientId} className="flex items-center gap-3">
              <LogoTile name={tool.name} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
                {toolForEditor(tool.name)?.name ?? tool.name}
              </span>
            </li>
          ))}
          {tools.length > 4 && (
            <li className="font-mono text-3xs text-muted-foreground">+{tools.length - 4} more</li>
          )}
        </ul>
      ) : (
        <span className="mt-1 block font-mono text-3xs text-muted-foreground">
          Claude Code, Codex or any MCP client
        </span>
      )}
      <span className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-foreground">
        {tools.length ? "Manage tools" : "Connect AI tools"}
        <ArrowRight
          aria-hidden="true"
          className="size-3.5 transition-transform duration-150 ease-standard group-hover:translate-x-0.5"
        />
      </span>
    </button>
  );
}

/** The desktop sidebar: sections, projects, and the connected AI editors at the bottom. It folds to icons. */
export function DashboardSidebar({
  onConnectAi,
  ...props
}: SidebarProps & { onConnectAi: () => void }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-divider bg-card pt-3 pb-4 transition-[width] duration-300 ease-standard lg:flex",
        "px-2",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mb-3 flex size-8 items-center justify-center text-muted-foreground transition-colors duration-150 ease-standard hover:text-ink",
          collapsed ? "self-center" : "self-end",
        )}
      >
        <Toggle aria-hidden="true" className="size-4" />
      </button>
      <SidebarNav {...props} collapsed={collapsed} />
      <EditorsCard onConnectAi={onConnectAi} collapsed={collapsed} />
    </aside>
  );
}

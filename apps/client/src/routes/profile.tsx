import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/dashboard-parts";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { DangerZone } from "@/components/profile/account-settings";
import { EditorsAndTokens } from "@/components/profile/editors-and-tokens";
import { ProfileDetails } from "@/components/profile/profile-details";
import { SignInMethods } from "@/components/profile/sign-in-methods";
import { authClient, requireSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { workspaceQuery } from "@/lib/workspace";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile - Prism" }] }),
  beforeLoad: () => requireSession(),
  // The sidebar lists the workspace; it's usually cached from the dashboard already.
  loader: ({ context: { queryClient } }) => {
    if (!queryClient.getQueryData(workspaceQuery.queryKey)) {
      void queryClient.prefetchQuery(workspaceQuery);
    }
  },
  component: ProfilePage,
});

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "sign-in", label: "Sign-in methods" },
  { id: "editors", label: "Editors and tokens" },
  { id: "danger", label: "Danger zone" },
] as const;

const joined = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function ProfilePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  // Searching from here goes on in the dashboard, once typing pauses (the page changes, so going
  // there on the first key would lose the next ones).
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(() => void navigate({ to: "/dashboard", search: { q: query } }), 350);
    return () => clearTimeout(timer);
  }, [query, navigate]);
  const session = authClient.useSession();
  const user = session.data?.user;

  return (
    <DashboardShell section={null} query={query} onQueryChange={setQuery}>
      <PageHeader
        title="Profile"
        summary={user ? `Your account · joined ${joined.format(new Date(user.createdAt))}` : ""}
      />
      {!user ? (
        <PrismLoader label="Loading your profile" className="mt-24" />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[11rem_minmax(0,1fr)]">
          <SectionNav />
          <div className="flex min-w-0 flex-col gap-6">
            <ProfileDetails user={user} />
            <SignInMethods />
            <EditorsAndTokens />
            <DangerZone />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

/** Jumps to a panel; the one in view is highlighted. Desktop only: phones just scroll. */
function SectionNav() {
  const [current, setCurrent] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        const top = visible.toSorted(
          (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
        )[0];
        if (top) setCurrent(top.target.id);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const { id } of SECTIONS) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Profile sections" className="max-lg:hidden">
      <ul className="sticky top-26 flex flex-col gap-1">
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={current === id ? "location" : undefined}
              className={cn(
                "flex h-9 items-center px-3 text-[13px] transition-colors duration-150 ease-standard",
                current === id
                  ? "bg-seafoam font-bold text-slate"
                  : "text-foreground hover:bg-muted",
                id === "danger" && current !== id && "text-destructive",
              )}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

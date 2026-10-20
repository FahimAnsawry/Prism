import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, CircleHelp, Globe, Monitor, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Chip, DetailRow, Handshake } from "@/components/auth/consent-parts";
import { FormError } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { UserAvatar } from "@/components/user-avatar";
import { authClient, requireSession, runAuthAction } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Consent for an AI editor (an MCP client like Claude Code) that asked to use the user's Prism
// account. Better Auth's OAuth provider sends the user here with a signed query (client_id,
// scope, …); the client plugin sends that query along with the answer, and the server checks it.
//
// Anyone can register a client and give it any name, so the name alone proves nothing. The page
// also shows where the access goes (the redirect's host, from the signed query): an editor on the
// user's own computer (Claude Code, Codex) sends it to localhost; anywhere else gets a warning.
//
// The layout is the "/oauth/consent" frames on the Prism — Auth redesign board: the crystal card
// with an editor ↔ Prism handshake, the signed-in account and where the editor is from.

export const Route = createFileRoute("/oauth/consent")({
  head: () => ({ meta: [{ title: "Allow access - Prism" }] }),
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: requireSession,
  component: ConsentPage,
});

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const urlOf = (value: unknown) =>
  typeof value === "string" && URL.canParse(value) ? new URL(value) : null;

/** A URL's host, or null when it isn't a URL. */
const hostOf = (value: unknown) => urlOf(value)?.host || null;

/**
 * Whether this page is inside another page's frame: a site could frame it and trick a click on
 * Allow (clickjacking), so a framed consent page shows nothing to click.
 */
function isFramed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const heading =
  "font-display text-[1.75rem] leading-[1.1] font-bold tracking-display text-ink sm:text-4xl";

function ConsentPage() {
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  const clientId = typeof search["client_id"] === "string" ? search["client_id"] : "";

  const client = useQuery({
    queryKey: ["oauth-client", clientId],
    queryFn: async () => {
      const { data } = await authClient.oauth2.publicClient({ query: { client_id: clientId } });
      return data ?? null;
    },
    enabled: Boolean(clientId),
    retry: false,
  });
  const name = client.data?.client_name || "this AI editor";
  const site = hostOf(client.data?.client_uri);
  // A Client ID Metadata Document client is identified by a URL its owner serves, so its host is
  // proven; a self-registered client's name and site are only what it said about itself.
  const verifiedHost = clientId.startsWith("https://") ? hostOf(clientId) : null;
  const redirect = urlOf(search["redirect_uri"]);
  const local = redirect?.protocol === "http:" && LOOPBACK_HOSTS.has(redirect.hostname);
  // An app link (vscode://, cursor://) shows with its scheme, a web address by its host.
  const destination = redirect
    ? redirect.protocol === "https:" || redirect.protocol === "http:"
      ? redirect.host
      : `${redirect.protocol}//${redirect.host}`
    : null;

  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState<string>();

  // On success the server answers with the client's redirect URL, which Better Auth's client
  // follows; the page stays as it is until the browser leaves.
  const answer = async (accept: boolean) => {
    setPending(accept ? "allow" : "deny");
    setError(undefined);
    const message = await runAuthAction(() => authClient.oauth2.consent({ accept }));
    if (message) {
      setError(message);
      setPending(null);
    }
  };

  if (isFramed()) {
    return (
      <AuthLayout crystal="medium">
        <h1 className={heading}>Open this page in its own tab</h1>
        <p className="mt-3 text-[15px] leading-normal text-muted-foreground">
          For your safety, Prism doesn&apos;t let other sites show this page inside theirs.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout crystal="medium">
      <Handshake local={local} />

      <h1 className={`mt-6 sm:mt-7 ${heading}`}>Allow {name} to use your Prism account?</h1>
      <p className="mt-3 text-[15px] leading-normal text-muted-foreground">
        It will read and edit your boards as you. Only allow an editor you just connected yourself.
      </p>

      <div className="mt-5 flex items-center gap-3 border border-divider px-3.5 py-3 sm:mt-6 sm:px-4">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.name || user.email}
          </p>
          {user.name && <p className="truncate text-[13px] text-muted-foreground">{user.email}</p>}
        </div>
        <span className="hidden items-center gap-1.5 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase sm:flex">
          <span aria-hidden="true" className="size-1.5 bg-brand" />
          Signed in
        </span>
      </div>

      <dl className="mt-5 flex flex-col gap-3 bg-fog/60 p-3.5 text-sm sm:mt-6 sm:gap-2.5 sm:p-4 sm:text-[13px]">
        <DetailRow
          label="Identified by"
          value={verifiedHost ?? site ?? "No website"}
          chip={
            verifiedHost ? (
              <Chip tone="ok" icon={<BadgeCheck />}>
                Verified
              </Chip>
            ) : (
              <Chip tone="warn" icon={<CircleHelp />}>
                Not verified
              </Chip>
            )
          }
        />
        <DetailRow
          label="Access goes to"
          value={local ? "This computer" : (destination ?? "An unknown address")}
          chip={
            local ? (
              <Chip tone="ok" icon={<Monitor />}>
                Local
              </Chip>
            ) : (
              <Chip tone="danger" icon={<Globe />}>
                Remote
              </Chip>
            )
          }
        />
      </dl>

      {!local && (
        <p
          role="alert"
          className="mt-4 flex gap-3 border border-destructive bg-destructive/5 px-4 py-3 text-[13px] leading-normal text-foreground"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            Editors on your computer, like Claude Code and Codex, receive access on localhost. This
            one sends it to{" "}
            <span className="font-bold [overflow-wrap:anywhere]">
              {destination ?? "an unknown address"}
            </span>
            . Allow it only if you set it up there yourself.
          </span>
        </p>
      )}

      <FormError message={error} className="mt-5" />
      {/* Allow sits on top on phones, to the right of Cancel from sm up. */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:mt-7 sm:flex-row">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void answer(false)}
          className={cn(ctaVariants({ variant: "outline" }), "h-12 sm:h-[45px] sm:flex-1")}
        >
          {pending === "deny" ? "Cancelling…" : "Cancel"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void answer(true)}
          className={cn(ctaVariants(), "h-12 sm:h-[45px] sm:flex-1")}
        >
          {pending === "allow" ? "Allowing…" : "Allow access"}
          {pending !== "allow" && <ArrowRight aria-hidden="true" />}
        </button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Revoke access anytime in Profile → Editors and tokens.
      </p>
    </AuthLayout>
  );
}

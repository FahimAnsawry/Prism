import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check, LayoutGrid, Mail, RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormError } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { authClient, requireSession, runAuthAction } from "@/lib/auth-client";

// Consent for an AI editor (an MCP client like Claude Code) that asked to use the user's Prism
// account. Better Auth's OAuth provider sends the user here with a signed query (client_id,
// scope, …); the client plugin sends that query along with the answer, and the server checks it.

export const Route = createFileRoute("/oauth/consent")({
  head: () => ({ meta: [{ title: "Allow access - Prism" }] }),
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: requireSession,
  component: ConsentPage,
});

/** What each requested scope lets the client do, in plain words. */
const SCOPE_TEXT: Record<string, { icon: ReactNode; text: string }> = {
  openid: { icon: <LayoutGrid />, text: "Read and change your boards and projects" },
  profile: { icon: <Check />, text: "See your name and profile photo" },
  email: { icon: <Mail />, text: "See your email address" },
  offline_access: { icon: <RefreshCw />, text: "Stay connected until you revoke it" },
};

function ConsentPage() {
  const search = Route.useSearch();
  const { user } = Route.useRouteContext();
  const clientId = typeof search["client_id"] === "string" ? search["client_id"] : "";
  const scopes = (typeof search["scope"] === "string" ? search["scope"] : "openid")
    .split(" ")
    .filter(Boolean);
  // Every client acts on the user's boards, so that line always shows first.
  const lines = [...new Set(["openid", ...scopes])].flatMap((scope) => SCOPE_TEXT[scope] ?? []);

  const client = useQuery({
    queryKey: ["oauth-client", clientId],
    queryFn: async () => {
      const { data } = await authClient.oauth2.publicClient({ query: { client_id: clientId } });
      return data ?? null;
    },
    enabled: Boolean(clientId),
    retry: false,
  });
  const name = client.data?.client_name || "An AI editor";
  const site = client.data?.client_uri;

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

  return (
    <AuthLayout panel={false}>
      <h1 className="font-display text-[2.25rem] leading-[1.1] font-bold tracking-display text-foreground sm:text-[2.875rem]">
        Allow {name}?
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        {name} wants to use your Prism account
        {site && (
          <>
            {" "}
            (<span className="text-foreground">{new URL(site).host}</span>)
          </>
        )}
        . Signed in as <span className="text-foreground">{user.email}</span>.
      </p>

      <ul className="mt-8 flex flex-col divide-y divide-divider border border-divider">
        {lines.map(({ icon, text }) => (
          <li key={text} className="flex items-center gap-3 px-4 py-3.5 text-sm text-foreground">
            <span aria-hidden="true" className="text-muted-foreground [&_svg]:size-4">
              {icon}
            </span>
            {text}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[13px] text-muted-foreground">
        Only allow an editor you just connected yourself.
      </p>

      <FormError message={error} className="mt-5" />
      <div className="mt-7 flex gap-3">
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void answer(false)}
          className={ctaVariants({ variant: "secondary", size: "sm", className: "flex-1" })}
        >
          {pending === "deny" ? "Cancelling…" : "Cancel"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          onClick={() => void answer(true)}
          className={ctaVariants({ size: "sm", className: "flex-1" })}
        >
          {pending === "allow" ? "Allowing…" : "Allow"}
        </button>
      </div>
    </AuthLayout>
  );
}

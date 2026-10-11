import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/auth-layout";
import { FormError } from "@/components/auth/form-field";
import { ctaVariants } from "@/components/cta";
import { PrismLoader } from "@/components/feedback/prism-loader";
import { ApiError, apiErrorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { inviteQuery, rememberPendingInvite, useAcceptInvite } from "@/lib/sharing";

// An invite to a board or project, sent to an email. Signed in with that email, one click
// accepts it; otherwise the visitor signs in or signs up first and comes back here.
export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [{ title: "Invite - Prism" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: InvitePage,
});

const heading = "text-[32px] leading-10 font-bold text-ink";

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const invite = useQuery(inviteQuery(token));
  const session = authClient.useSession();
  const accept = useAcceptInvite(token);

  if (invite.isPending || session.isPending) {
    return <PrismLoader fullScreen label="Opening invite" />;
  }

  if (invite.error || !invite.data) {
    const gone = invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <AuthLayout panel={false}>
        <div className="mx-auto my-auto w-full max-w-md py-16">
          <h1 className={heading}>
            {gone ? "This invite isn't valid" : "Couldn't open the invite"}
          </h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            {gone
              ? "It was cancelled or already used. Ask the person who invited you for a new one."
              : apiErrorMessage(invite.error)}
          </p>
          <Link to="/dashboard" className={ctaVariants({ size: "lg", className: "mt-8" })}>
            Go to your dashboard
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const { kind, name, role, email, invitedBy } = invite.data;
  const user = session.data?.user;
  const matches = user?.email.toLowerCase() === email;
  const what = kind === "project" ? `the project “${name}” and its boards` : `the board “${name}”`;

  const goSignIn = (to: "/login" | "/signup") => {
    // The dashboard sends them back here once they're in.
    rememberPendingInvite(token);
    void navigate({ to });
  };
  const switchAccount = async () => {
    rememberPendingInvite(token);
    await authClient.signOut();
    await navigate({ to: "/login" });
  };
  const onAccept = () =>
    accept.mutate(undefined, {
      onSuccess: ({ kind: acceptedKind, id }) => {
        if (acceptedKind === "board")
          void navigate({ to: "/board/$boardId", params: { boardId: id } });
        else void navigate({ to: "/dashboard" });
      },
    });

  return (
    <AuthLayout panel={false}>
      <div className="mx-auto my-auto w-full max-w-md py-16">
        <p className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
          {role === "editor" ? "Invite to edit" : "Invite to view"}
        </p>
        <h1 className={`mt-3 ${heading}`}>
          {invitedBy} invited you to {role === "editor" ? "edit" : "view"} {what}
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          This invite is for <span className="font-bold text-foreground">{email}</span>.
        </p>

        <FormError
          message={accept.error ? apiErrorMessage(accept.error) : undefined}
          className="mt-6"
        />

        {!user ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => goSignIn("/login")}
              className={ctaVariants({ size: "lg" })}
            >
              Log in to accept
            </button>
            <button
              type="button"
              onClick={() => goSignIn("/signup")}
              className={ctaVariants({ variant: "secondary", size: "lg" })}
            >
              Create an account
            </button>
          </div>
        ) : matches ? (
          <div className="mt-8">
            <button
              type="button"
              onClick={onAccept}
              disabled={accept.isPending}
              className={ctaVariants({ size: "lg" })}
            >
              {accept.isPending ? "Accepting…" : "Accept invite"}
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <p className="text-[15px] text-foreground">
              You're signed in as <span className="font-bold">{user.email}</span>. Switch to the
              account for {email} to accept.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void switchAccount()}
                className={ctaVariants({ size: "lg" })}
              >
                Switch account
              </button>
              <Link to="/dashboard" className={ctaVariants({ variant: "secondary", size: "lg" })}>
                Not now
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

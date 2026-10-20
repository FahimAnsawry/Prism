import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The hero's four view thumbnails (204×150 each), all drawn from one idea: "Let teammates join a
 * board with a role". Wireframe, flowchart, database and code of the same invite feature. They
 * follow light and dark through the theme tokens.
 */
type ArtProps = Omit<SVGProps<SVGSVGElement>, "viewBox">;

function Art({ className, children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 204 150" aria-hidden="true" className={cn("block", className)} {...props}>
      {children}
    </svg>
  );
}

/** The invite dialog: email, role, two members with role chips, one action. */
export function InviteWireframeArt(props: ArtProps) {
  return (
    <Art {...props}>
      <rect
        x="14"
        y="8"
        width="176"
        height="134"
        strokeWidth="1.5"
        className="fill-background stroke-foreground"
      />
      <rect x="26" y="20" width="62" height="8" className="fill-foreground" />
      <rect x="26" y="38" width="96" height="16" className="fill-white stroke-input" />
      <rect x="128" y="38" width="50" height="16" className="fill-white stroke-input" />
      <path d="M164 44 168 48 172 44" fill="none" strokeWidth="1.5" className="stroke-foreground" />
      <circle cx="34" cy="73" r="6" className="fill-lavender" />
      <rect x="46" y="70" width="56" height="5" className="fill-foreground" />
      <rect x="138" y="68" width="40" height="10" className="fill-ice" />
      <circle cx="34" cy="92" r="6" className="fill-seafoam" />
      <rect x="46" y="89" width="44" height="5" className="fill-foreground" />
      <rect x="138" y="87" width="40" height="10" className="fill-lime" />
      <rect x="26" y="112" width="152" height="18" className="fill-brand" />
      <rect x="76" y="119" width="52" height="4" className="fill-slate" />
    </Art>
  );
}

/** Invite → valid? → join, or expired. */
export function InviteFlowchartArt(props: ArtProps) {
  return (
    <Art {...props}>
      <g strokeWidth="1.5" className="stroke-foreground">
        <rect x="6" y="58" width="52" height="32" className="fill-ice" />
        <path d="M98 44 124 74 98 104 72 74Z" className="fill-white" />
        <rect x="146" y="14" width="52" height="32" className="fill-seafoam" />
        <rect x="146" y="102" width="52" height="32" className="fill-peach" />
        <path d="M58 74H72M124 74H134V30H142M134 74V118H142" fill="none" />
      </g>
      <g className="fill-foreground">
        <path d="M65 70 71 74 65 78Z" />
        <path d="M140 26 146 30 140 34Z" />
        <path d="M140 114 146 118 140 122Z" />
      </g>
      <g fontSize="10" fontWeight="600" textAnchor="middle" className="font-sans">
        <text x="32" y="77" className="fill-slate">
          Invite
        </text>
        <text x="98" y="77" className="fill-foreground">
          Valid?
        </text>
        <text x="172" y="33" className="fill-slate">
          Join
        </text>
        <text x="172" y="121" className="fill-slate">
          Expired
        </text>
      </g>
    </Art>
  );
}

/** board_member and share_invite, the two tables behind an invite. */
export function InviteDatabaseArt(props: ArtProps) {
  return (
    <Art {...props}>
      <g strokeWidth="1.5" className="stroke-foreground">
        <rect x="6" y="22" width="86" height="100" className="fill-white" />
        <rect x="108" y="38" width="90" height="100" className="fill-white" />
        <path d="M92 62H108M100 56 108 62 100 68" fill="none" />
      </g>
      <rect x="6" y="22" width="86" height="20" className="fill-violet" />
      <rect x="108" y="38" width="90" height="20" className="fill-violet" />
      <g fontSize="9" className="font-mono">
        <g fontWeight="700" className="fill-white">
          <text x="13" y="36">
            board_member
          </text>
          <text x="115" y="52">
            share_invite
          </text>
        </g>
        <g className="fill-foreground">
          <text x="13" y="62">
            board_id
          </text>
          <text x="13" y="82">
            user_id
          </text>
          <text x="13" y="102">
            role
          </text>
          <text x="115" y="78">
            board_id
          </text>
          <text x="115" y="98">
            email
          </text>
          <text x="115" y="118">
            token
          </text>
        </g>
      </g>
    </Art>
  );
}

/** The invite form as the editor would code it. */
export function InviteCodeArt(props: ArtProps) {
  return (
    <Art {...props}>
      <rect width="204" height="150" className="fill-inverse" />
      <g fontSize="11" className="font-mono">
        <text x="12" y="26" className="fill-coral">
          {"<InviteForm>"}
        </text>
        <text x="24" y="46" className="fill-ice">
          {"<Input email />"}
        </text>
        <text x="24" y="66" className="fill-ice">
          {"<RoleSelect"}
        </text>
        <text x="102" y="66" className="fill-lime">
          "editor"
        </text>
        <text x="24" y="86" className="fill-ice">
          {"<Button>"}
        </text>
        <text x="36" y="106" className="fill-fog">
          Send invite
        </text>
        <text x="24" y="126" className="fill-ice">
          {"</Button>"}
        </text>
        <text x="12" y="146" className="fill-coral">
          {"</InviteForm>"}
        </text>
      </g>
    </Art>
  );
}

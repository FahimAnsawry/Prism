import { ChevronDown, Link2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";

const PEOPLE = [
  { name: "Fahim Ansawry", email: "fahim@harborgym.co", avatar: "fahim", role: "Owner" },
  { name: "Maya Okafor", email: "maya@harborgym.co", avatar: "maya", role: "Editor" },
  { name: "Jun Park", email: "jun@harborgym.co", avatar: "jun", role: "Viewer" },
];

/** The board's Share dialog, drawn as a still picture. */
function ShareDialogMock() {
  return (
    <div
      role="img"
      aria-label="The Share dialog for a board named Harbor Gym: Fahim is the owner, Maya is an editor, Jun is a viewer, and anyone with the link can view."
      className="w-full max-w-140 shrink-0 bg-card p-5 text-foreground sm:p-7 shadow-[0_16px_40px_-12px_rgb(61_59_80/0.25)] dark:shadow-[0_16px_40px_-12px_rgb(0_0_0/0.6)]"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-xl font-semibold">Share “Harbor Gym”</p>
        <X className="size-[18px] text-muted-foreground" />
      </div>
      <div className="mt-6 flex gap-2">
        <p className="flex h-11 min-w-0 flex-1 items-center border border-input bg-white px-3 text-base text-muted-foreground dark:bg-background">
          Add people by email
        </p>
        <p className="flex h-11 items-center bg-secondary px-[18px] font-mono text-xs font-bold tracking-[0.08em] text-secondary-foreground">
          INVITE
        </p>
      </div>

      <ul className="mt-6 space-y-4">
        {PEOPLE.map((person) => (
          <li key={person.email} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={`/landing/avatar-${person.avatar}.png`}
                alt=""
                width={36}
                height={36}
                className="size-9 shrink-0 rounded-full bg-fog"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{person.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{person.email}</p>
              </div>
            </div>
            {person.role === "Owner" ? (
              <p className="text-sm text-muted-foreground">Owner</p>
            ) : (
              <p className="flex items-center gap-1 text-sm font-medium">
                {person.role}
                <ChevronDown className="size-4" />
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-6">
        <p className="flex items-center gap-2.5 text-sm">
          <Link2 className="size-4" />
          Anyone with the link can view
        </p>
        <p className="font-mono text-xs font-bold tracking-[0.08em] whitespace-nowrap">COPY LINK</p>
      </div>
    </div>
  );
}

export function SharingSection() {
  return (
    <section id="sharing" aria-labelledby="sharing-title">
      <div
        className={cn(
          pageContainer,
          "flex flex-col-reverse gap-10 pt-16 md:gap-12 md:pt-24 lg:flex-row lg:items-center lg:gap-24 lg:pt-32",
        )}
      >
        <Reveal className="w-full max-w-140 shrink-0">
          <ShareDialogMock />
        </Reveal>
        <div className="max-w-140">
          <Reveal step={1}>
            <h2
              id="sharing-title"
              className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-foreground sm:text-5xl"
            >
              Share a link.
              <br />
              Keep the edit button.
            </h2>
          </Reveal>
          <Reveal step={2}>
            <p className="mt-6 text-lg leading-normal text-foreground md:text-xl">
              Invite people as editors or viewers, or send a public link that opens the board
              read-only. Cursors, edits and your AI editor's changes show up for everyone as they
              happen.
            </p>
          </Reveal>
          <Reveal step={3}>
            <p className="mt-6 font-hand text-2xl leading-[1.1] text-muted-foreground">
              only the owner can move or delete it
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

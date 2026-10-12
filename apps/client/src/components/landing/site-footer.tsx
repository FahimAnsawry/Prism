import { PrismLogo } from "@/components/prism-logo";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";

// Links without an href are plain text until those pages ship.
const COLUMNS: { title: string; links: { label: string; href?: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Views", href: "#views" },
      { label: "Editors", href: "#how-it-works" },
      { label: "Code", href: "#code" },
      { label: "Sharing", href: "#sharing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "MCP setup", href: "#how-it-works" },
      { label: "Docs" },
      { label: "GitHub", href: "https://github.com/FahimAnsawry/Prism" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "About" }, { label: "Privacy" }, { label: "Terms" }],
  },
];

export function SiteFooter() {
  return (
    <footer className={cn(pageContainer, "pt-12 pb-10 md:pt-16 md:pb-12")}>
      <div className="flex flex-col gap-10 md:flex-row md:justify-between md:gap-12">
        <Reveal>
          <PrismLogo />
          <p className="mt-3 text-sm text-muted-foreground">One idea broken into many views.</p>
        </Reveal>

        {/* Three columns at every width, so Company sits beside Developers on phones too. */}
        <div className="grid grid-cols-3 gap-x-3 sm:gap-x-0">
          {COLUMNS.map((column, i) => (
            <Reveal key={column.title} step={i + 1} className="sm:w-52 sm:last:w-auto">
              <h2 className="font-mono text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-3 text-sm text-foreground">
                {column.links.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        className="underline-offset-4 transition-colors hover:text-ink hover:underline"
                      >
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>

      <p className="mt-12 text-xs text-muted-foreground md:mt-16">© 2026 Prism</p>
    </footer>
  );
}

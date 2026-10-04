import { PrismLogo } from "@/components/prism-logo";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";

// TODO: plain text until these pages ship; then make each one a router <Link>.
const COLUMNS = [
  { title: "Product", links: ["Canvas", "Templates", "Pricing"] },
  { title: "Developers", links: ["MCP bridge", "Docs", "GitHub"] },
  { title: "Company", links: ["About", "Privacy", "Terms"] },
];

export function SiteFooter() {
  return (
    <footer className={cn(pageContainer, "pt-10 pb-10")}>
      <div className="flex flex-col gap-12 md:flex-row md:justify-between">
        <div>
          <PrismLogo />
          <p className="mt-6 text-lg tracking-body text-muted-foreground">
            One idea broken into many views.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title} className="w-[12.5rem] max-sm:w-auto">
              <h2 className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
                {column.title}
              </h2>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link} className="text-base text-foreground">
                    {link}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        © 2026 Prism
      </p>
    </footer>
  );
}

import { Link, type LinkProps } from "@tanstack/react-router";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { PrismMark } from "@/components/prism-logo";
import { EASE_DECELERATE } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { pageContainer } from "./page-container";
import { Reveal } from "./reveal";

type FooterLink = {
  label: string;
  href?: string;
  to?: LinkProps["to"];
  params?: Record<string, string>;
  /** Opens in a new tab (the docs). */
  newTab?: boolean;
};

// Links with neither an href nor a route are plain text until those pages ship.
const COLUMNS: { title: string; links: FooterLink[] }[] = [
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
      {
        label: "MCP setup",
        to: "/docs/$",
        params: { _splat: "connect-claude-code" },
        newTab: true,
      },
      { label: "Docs", to: "/docs", newTab: true },
      { label: "GitHub", href: "https://github.com/FahimAnsawry/Prism" },
    ],
  },
  {
    title: "Company",
    links: [{ label: "About", to: "/about" }, { label: "Privacy" }, { label: "Terms" }],
  },
];

/** The beams the prism splits the line into: one per view, each with the tool that draws it. */
const VIEWS = [
  { name: "UI", tool: "create_screen", stroke: "stroke-brand", fill: "bg-brand", y: 10 },
  { name: "Flowchart", tool: "create_elements", stroke: "stroke-sky", fill: "bg-sky", y: 30 },
  {
    name: "Database",
    tool: "create_er_diagram",
    stroke: "stroke-violet",
    fill: "bg-violet",
    y: 50,
  },
  { name: "Code", tool: "get_screen_code", stroke: "stroke-coral", fill: "bg-coral", y: 70 },
];

const linkClass = "underline-offset-4 transition-colors hover:text-brand hover:underline";

function FooterLinkItem({ label, href, to, params, newTab }: FooterLink) {
  if (to) {
    return (
      <Link
        to={to}
        params={params}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noopener" : undefined}
        activeProps={{ className: "font-semibold text-brand", "aria-current": "page" }}
        activeOptions={{ exact: true }}
        className={linkClass}
      >
        {label}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={linkClass}>
        {label}
      </a>
    );
  }
  return label;
}

// The line runs in, the prism splits it, then the beams run out to their views.
const beamIn: Variants = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.4, ease: "easeIn" } },
};
const fan: Variants = {
  hidden: { pathLength: 0 },
  shown: { pathLength: 1, transition: { duration: 0.3, delay: 0.4, ease: "linear" } },
};
const beamOut: Variants = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: 0.6, delay: 0.7, ease: EASE_DECELERATE } },
};

/**
 * The slogan drawn: one line enters the prism and leaves as four colored beams, each ending at a
 * view and the tool an AI editor draws it with. The beams stretch to fill the row; the fan out of
 * the prism keeps its shape. Phones drop the tool names and most of the incoming line.
 */
function Refraction() {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.8 }}
      className="flex items-center gap-4"
    >
      <div aria-hidden="true" className="flex min-w-0 flex-1 items-center">
        <motion.div
          variants={beamIn}
          className="h-[1.5px] w-6 shrink-0 origin-left bg-inverse-foreground sm:w-36"
        />
        <PrismMark className="shrink-0 fill-inverse-foreground" />
        <svg viewBox="0 0 110 80" className="h-20 w-[110px] shrink-0 fill-none stroke-2">
          {VIEWS.map(({ name, stroke, y }) => (
            <motion.path
              key={name}
              d={`M0 40C50 40 58 ${y} 110 ${y}`}
              variants={fan}
              className={stroke}
            />
          ))}
        </svg>
        <div className="flex h-20 min-w-6 flex-1 flex-col justify-between py-[9px]">
          {VIEWS.map(({ name, fill }) => (
            <motion.div
              key={name}
              variants={beamOut}
              className={cn("relative h-0.5 origin-left", fill)}
            >
              <span className={cn("absolute -top-0.5 right-0 size-1.5", fill)} />
            </motion.div>
          ))}
        </div>
      </div>

      <Reveal step={2}>
        <ul aria-label="Views" className="flex h-20 flex-col">
          {VIEWS.map(({ name, tool }) => (
            <li key={name} className="flex h-5 items-center gap-3">
              <Link
                to="/docs/$"
                params={{ _splat: `tools/${tool.replaceAll("_", "-")}` }}
                target="_blank"
                rel="noopener"
                className={cn("w-20 text-sm font-semibold", linkClass)}
              >
                {name}
              </Link>
              <code className="font-mono text-xs text-ash max-sm:hidden">{tool}</code>
            </li>
          ))}
        </ul>
      </Reveal>
    </motion.div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-inverse text-inverse-foreground [--focus-ring:var(--color-fog)]">
      <div className={cn(pageContainer, "pt-16 md:pt-24")}>
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-16">
          <Reveal>
            <p className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-balance sm:text-5xl">
              One idea
              <br className="max-sm:hidden" /> broken into many views.
            </p>
          </Reveal>

          {/* Three columns at every width, so Company sits beside Developers on phones too. */}
          <div className="grid grid-cols-3 gap-x-3 self-start sm:grid-cols-[9rem_9rem_auto] sm:gap-x-16">
            {COLUMNS.map((column, i) => (
              <Reveal key={column.title} step={i + 1}>
                <h2 className="font-mono text-xs font-bold tracking-[0.1em] text-ash uppercase">
                  {column.title}
                </h2>
                <ul className="mt-3 space-y-3 text-sm">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLinkItem {...link} />
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="mt-16 md:mt-24">
          <Refraction />
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-fog/15 pt-6 pb-8 text-xs text-ash sm:flex-row sm:justify-between md:mt-16">
          <p>© 2026 Prism</p>
          <p>Plain SVG and React. No drawing libraries.</p>
        </div>
      </div>
    </footer>
  );
}

import type { ReactNode } from "react";

/** The login/signup title (48px Anybody) with its "New to Prism? Create an account" line. */
export function AuthHeading({
  children,
  prompt,
  link,
}: {
  children: ReactNode;
  prompt: string;
  link: ReactNode;
}) {
  return (
    <>
      <h1 className="font-display text-[2.5rem] leading-[1.05] font-bold tracking-display text-foreground sm:text-5xl">
        {children}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        {prompt}{" "}
        <span className="ml-0.5 font-semibold text-foreground [&_a]:underline-offset-4 [&_a]:transition-colors [&_a]:hover:text-ink [&_a]:hover:underline">
          {link}
        </span>
      </p>
    </>
  );
}

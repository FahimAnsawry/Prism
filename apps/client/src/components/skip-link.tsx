/**
 * "Skip to content": the first stop for the Tab key, hidden until it has focus. It moves focus to
 * the page's <main> (which needs the matching id and tabIndex={-1}) without changing the URL.
 */
export function SkipLink({ target = "main" }: { target?: string }) {
  return (
    <a
      href={`#${target}`}
      onClick={(event) => {
        const main = document.getElementById(target);
        if (!main) return;
        event.preventDefault();
        main.focus({ preventScroll: true });
        main.scrollIntoView();
      }}
      className="fixed top-3 left-3 z-[100] -translate-y-[200%] bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground focus-visible:translate-y-0"
    >
      Skip to content
    </a>
  );
}

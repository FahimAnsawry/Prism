import type { LucideIconData } from "lucide-react";
import { useEffect, useState } from "react";

// Icon elements draw Lucide icons by name. Lucide's catalog (name → loader) and each icon's
// shapes are separate downloads, fetched the first time a board shows an icon or the picker opens.
// Loaded icons are kept here, so later renders are synchronous.

type IconModule = { __iconData?: LucideIconData };
type Catalog = Record<string, () => Promise<IconModule>>;

let catalog: Promise<Catalog> | undefined;
let names: readonly string[] | undefined;

function loadCatalog() {
  catalog ??= import("lucide-react/dynamic").then(
    (module) => {
      names = module.iconNames;
      return module.dynamicIconImports as Catalog;
    },
    (error: unknown) => {
      // Not remembered, so the next icon shown tries again.
      catalog = undefined;
      throw error;
    },
  );
  return catalog;
}

/** Loaded icons; null for a name Lucide doesn't have. */
const loaded = new Map<string, LucideIconData | null>();
const pending = new Map<string, Promise<void>>();

function loadIcon(name: string): Promise<void> {
  if (loaded.has(name)) return Promise.resolve();
  let load = pending.get(name);
  if (!load) {
    load = loadCatalog()
      .then(async (icons) => {
        const module = Object.hasOwn(icons, name) ? await icons[name]?.() : undefined;
        loaded.set(name, module?.__iconData ?? null);
      })
      // A failed download isn't remembered, so the icon loads again the next time it's shown.
      .catch(() => undefined)
      .finally(() => pending.delete(name));
    pending.set(name, load);
  }
  return load;
}

/** The icon's data: undefined while it loads, null if there's no such icon. */
export function useIconData(name: string) {
  const [, setLoads] = useState(0);
  useEffect(() => {
    if (loaded.has(name)) return;
    let live = true;
    void loadIcon(name).then(() => {
      if (live) setLoads((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [name]);
  return loaded.get(name);
}

/** Every Lucide icon name (aliases included), or undefined until the catalog has loaded. */
export function useIconNames() {
  const [, setLoads] = useState(0);
  useEffect(() => {
    if (names) return;
    let live = true;
    loadCatalog().then(
      () => {
        if (live) setLoads((n) => n + 1);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return names;
}

/** Loads icons ahead of a render that has to be complete at once (an image export). */
export async function preloadIcons(names: Iterable<string>) {
  await Promise.all([...new Set(names)].map(loadIcon));
}

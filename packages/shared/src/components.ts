import { z } from "zod";
import {
  componentNameSchema,
  componentPropValueSchema,
  type LayoutContainer,
  type LayoutDivider,
  type LayoutNode,
  layoutNodeSchema,
  type LayoutSlot,
  type LayoutSpacer,
  type LayoutUse,
} from "./layout.js";

// Project components: Button, Input, Card, Sidebar, … defined once per project as layout trees
// and placed in create_screen with { type: "use", component: "Button", variant: "ghost",
// props: { label: "Cancel" } }. Every screen gets the same shape, spacing and parts, and every
// element an instance draws is tagged with it (`component`), so the code builds each component
// once and reuses it.

const propName = z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/, "Use letters and digits.");
const variantName = z.string().regex(/^[a-z][a-z0-9-]{0,30}$/, 'Use lowercase, e.g. "primary".');

export const componentSchema = z.object({
  description: z.string().max(500).optional(),
  /** Placeholders the tree uses as {{name}}, with optional defaults. */
  props: z
    .record(
      propName,
      z.object({
        default: componentPropValueSchema.optional(),
        description: z.string().max(200).optional(),
      }),
    )
    .default({}),
  /** Named sets of prop values, e.g. primary: { bg: "$primary", fg: "$primary-foreground" }. */
  variants: z.record(variantName, z.record(propName, componentPropValueSchema)).default({}),
  defaultVariant: variantName.optional(),
  /** A layout tree (as in create_screen) with {{prop}} placeholders and { type: "slot" } nodes. */
  root: z.unknown(),
  /** Where the app has it, e.g. "@/components/ui/button", for the code. */
  code: z.string().max(200).optional(),
});

export const componentsSchema = z.record(componentNameSchema, componentSchema);
export const COMPONENTS_MAX = 60;

export type Component = z.infer<typeof componentSchema>;
export type Components = z.infer<typeof componentsSchema>;
type PropValue = z.infer<typeof componentPropValueSchema>;

/** Components nest (a Sidebar uses NavItem) up to this deep. */
const MAX_DEPTH = 6;
const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g;
const WHOLE = /^\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}$/;

class ExpandError extends Error {}

/**
 * Fills {{prop}} placeholders. A whole-string placeholder takes the value's type (a number stays
 * a number) and null drops the field; one inside text is interpolated.
 */
function substitute(
  value: unknown,
  values: Record<string, PropValue>,
  missing: Set<string>,
): unknown {
  if (typeof value === "string") {
    const whole = WHOLE.exec(value)?.[1];
    if (whole !== undefined) {
      if (!(whole in values)) missing.add(whole);
      const v = values[whole];
      return v === null ? undefined : (v ?? value);
    }
    return value.replace(PLACEHOLDER, (_, key: string) => {
      if (!(key in values)) missing.add(key);
      return String(values[key] ?? "");
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => substitute(v, values, missing)).filter((v) => v !== undefined);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      const filled = substitute(v, values, missing);
      if (filled !== undefined) out[key] = filled;
    }
    return out;
  }
  return value;
}

const isContainer = (node: LayoutNode): node is LayoutContainer =>
  node.type === "stack" || node.type === "row" || node.type === "grid" || node.type === "overlay";
/** Nodes that take a name (groupId) and a role. */
const named = (
  node: LayoutNode,
): node is Exclude<LayoutNode, LayoutSpacer | LayoutSlot | LayoutDivider | LayoutUse> =>
  node.type !== "spacer" && node.type !== "slot" && node.type !== "divider" && node.type !== "use";

/** Puts `children` where the tree's slot nodes are. */
function fillSlots(node: LayoutNode, children: LayoutNode[]): LayoutNode {
  if (!isContainer(node)) return node;
  return {
    ...node,
    children: node.children.flatMap((child) =>
      child.type === "slot" ? children : [fillSlots(child, children)],
    ),
  };
}

interface Context {
  /** The instance being drawn ("Card", "Sidebar > NavItem:active"), if any. */
  tag: string | undefined;
  /** Inside a component's own tree: only the instance's root keeps a name (one group). */
  inside: boolean;
  /** The components being expanded, outermost first, to catch cycles. */
  stack: string[];
}

/**
 * Replaces every `use` node with its component's tree: props filled (use props > variant >
 * defaults), slots filled with the use's children, each instance one group, and every node it
 * draws tagged with the instance (`component`). Returns errors an AI editor can act on.
 */
export function expandComponents(root: LayoutNode, components: Components) {
  const names = Object.keys(components);

  function expandUse(use: LayoutUse, ctx: Context): LayoutNode {
    const def = components[use.component];
    if (!def) {
      throw new ExpandError(
        names.length > 0
          ? `No component "${use.component}" in this project. It has: ${names.join(", ")}.`
          : `This project has no components yet. Define "${use.component}" with define_component first.`,
      );
    }
    if (ctx.stack.includes(use.component) || ctx.stack.length >= MAX_DEPTH) {
      throw new ExpandError(
        `Components nest too deep: ${[...ctx.stack, use.component].join(" > ")}.`,
      );
    }
    const variants = Object.keys(def.variants);
    if (use.variant !== undefined && !(use.variant in def.variants)) {
      throw new ExpandError(
        `${use.component} has no variant "${use.variant}"${variants.length > 0 ? `; it has: ${variants.join(", ")}` : ""}.`,
      );
    }
    const variant = use.variant ?? def.defaultVariant ?? variants[0];
    const values: Record<string, PropValue> = {};
    for (const [key, prop] of Object.entries(def.props)) {
      if (prop.default !== undefined) values[key] = prop.default;
    }
    Object.assign(values, variant ? def.variants[variant] : undefined, use.props);

    // The children belong to the screen using the component, not to the component.
    const children = (use.children ?? []).flatMap((child) => expand(child, ctx));
    const missing = new Set<string>();
    const filled = layoutNodeSchema.safeParse(substitute(def.root, values, missing));
    if (missing.size > 0) {
      throw new ExpandError(`${use.component} needs props: ${[...missing].join(", ")}.`);
    }
    if (!filled.success) {
      throw new ExpandError(
        `${use.component}'s tree isn't a valid layout once its props are filled: ${z.prettifyError(filled.error)}`,
      );
    }

    const label = variant ? `${use.component}:${variant}` : use.component;
    const tag = ctx.inside && ctx.tag ? `${ctx.tag} > ${label}` : label;
    const [drawn] = expand(filled.data, {
      tag,
      inside: true,
      stack: [...ctx.stack, use.component],
    });
    let instance = fillSlots(drawn ?? filled.data, children);
    if (isContainer(instance)) {
      instance = {
        ...instance,
        ...(use.width !== undefined && { width: use.width }),
        ...(use.height !== undefined && { height: use.height }),
      };
    } else if (instance.type === "box") {
      instance = {
        ...instance,
        ...(use.width !== undefined && { width: use.width }),
        ...(typeof use.height === "number" && { height: use.height }),
      };
    } else if (instance.type === "text" && use.width !== undefined) {
      instance = { ...instance, width: use.width };
    }
    if (named(instance)) {
      if (use.role) instance = { ...instance, role: use.role };
      // Placed in an overlay where it's used.
      instance = {
        ...instance,
        ...(use.anchor !== undefined && { anchor: use.anchor }),
        ...(use.x !== undefined && { x: use.x }),
        ...(use.y !== undefined && { y: use.y }),
      };
      // On a screen an instance is one group, so it moves as one.
      if (!ctx.inside) instance = { ...instance, name: use.name ?? use.component };
    }
    return instance;
  }

  function expand(node: LayoutNode, ctx: Context): LayoutNode[] {
    if (node.type === "slot") {
      if (!ctx.inside) throw new ExpandError('A { type: "slot" } only goes in a component.');
      return [node];
    }
    if (node.type === "use") return [expandUse(node, ctx)];
    if (node.type === "spacer") return [node];
    let out: LayoutNode = node;
    if (ctx.inside && named(out) && out.name !== undefined) out = { ...out, name: undefined };
    if (ctx.tag) out = { ...out, component: ctx.tag } as LayoutNode;
    if (isContainer(out)) {
      out = { ...out, children: out.children.flatMap((child) => expand(child, ctx)) };
    }
    return [out];
  }

  try {
    const [expanded] = expand(root, { tag: undefined, inside: false, stack: [] });
    return { root: expanded ?? root, errors: [] as string[] };
  } catch (error) {
    if (error instanceof ExpandError) return { root, errors: [error.message] };
    throw error;
  }
}

/** Stand-in values for required props while checking, by the field they fill. */
const STUBS: Record<string, PropValue> = {
  icon: "circle",
  color: "$foreground",
  fill: "$muted",
  stroke: "$border",
  textStyle: "$body",
  font: "$sans",
  radius: "$radius-md",
};
const NUMERIC_FIELDS = new Set([
  "gap",
  "size",
  "width",
  "height",
  "thickness",
  "columns",
  "padding",
]);

/** A value that fits wherever `prop` is used as a whole-string placeholder ("Text" in text). */
function stubFor(tree: unknown, prop: string): PropValue {
  let stub: PropValue = "Text";
  const visit = (value: unknown, key: string | undefined) => {
    if (typeof value === "string" && key && WHOLE.exec(value)?.[1] === prop) {
      if (key in STUBS) stub = STUBS[key] ?? stub;
      else if (NUMERIC_FIELDS.has(key)) stub = 8;
    } else if (Array.isArray(value)) value.forEach((v) => visit(v, key));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) visit(v, k);
    }
  };
  visit(tree, undefined);
  return stub;
}

/**
 * Checks a component before it's saved: every variant expands into a valid layout. Props
 * without a default get a stand-in that fits their field. Returns the expanded trees (for theme
 * checks) or errors.
 */
export function checkComponent(name: string, component: Component, components: Components) {
  const all = { ...components, [name]: component };
  const variants = Object.keys(component.variants);
  const trees: LayoutNode[] = [];
  const errors: string[] = [];
  for (const variant of variants.length > 0 ? variants : [undefined]) {
    const props: Record<string, PropValue> = {};
    for (const [key, prop] of Object.entries(component.props)) {
      if (prop.default === undefined && !(variant && key in (component.variants[variant] ?? {}))) {
        props[key] = stubFor(component.root, key);
      }
    }
    const use: LayoutUse = { type: "use", component: name, variant, props };
    const result = expandComponents(use, all);
    if (result.errors.length > 0) errors.push(...result.errors);
    else trees.push(result.root);
  }
  if (component.defaultVariant && !variants.includes(component.defaultVariant)) {
    errors.push(`defaultVariant "${component.defaultVariant}" isn't one of its variants.`);
  }
  return { trees, errors: [...new Set(errors)] };
}

/** Which components a tree (or a component's tree) uses, by name. */
export function usedComponents(tree: unknown, found = new Set<string>()) {
  if (Array.isArray(tree)) tree.forEach((child) => usedComponents(child, found));
  else if (tree && typeof tree === "object") {
    const node = tree as Record<string, unknown>;
    if (node["type"] === "use" && typeof node["component"] === "string") {
      found.add(node["component"]);
    }
    Object.values(node).forEach((value) => usedComponents(value, found));
  }
  return found;
}

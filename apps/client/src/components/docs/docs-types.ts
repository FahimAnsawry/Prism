/** The groups the sidebar is organised by: the job a reader is doing, not the Prism feature. */
export type DocsGroup = "start" | "design" | "collaborate" | "build" | "reference";

export type FigureName =
  | "architecture"
  | "startNote"
  | "boardMock"
  | "tokenManager"
  | "frameSizes"
  | "swatches"
  | "componentVariants"
  | "sameSite"
  | "shareDialog"
  | "askAi"
  | "lightDark"
  | "roundTrip"
  | "erResult"
  | "pipeline";

export type CalloutIcon =
  | "key"
  | "undo"
  | "folder"
  | "route"
  | "shield"
  | "users"
  | "palette"
  | "puzzle"
  | "eye"
  | "ruler"
  | "refresh"
  | "database"
  | "bell";

export type NoteIcon = "book" | "alert" | "layers" | "pencil" | "link" | "check";

/**
 * One piece of a docs page. Prose strings may hold `code` spans (backticks) and the {{mcp}}
 * placeholder, which becomes this server's MCP endpoint.
 */
export type Block =
  | { type: "h2"; title: string; id?: string }
  | { type: "p"; text: string }
  | { type: "checks"; items: string[] }
  | { type: "steps"; steps: { title: string; blocks: Block[] }[] }
  | { type: "command"; title: string; command: string }
  | { type: "code"; title: string; code: string }
  | { type: "tabs"; tabs: { label: string; code: string }[] }
  | { type: "prompt"; text: string }
  | { type: "callout"; icon: CalloutIcon; title: string; blocks: Block[] }
  | { type: "table"; head: string[]; rows: string[][]; mono?: number[] }
  | { type: "defs"; rows: { term: string; text: string; mono?: boolean; badge?: boolean }[] }
  | { type: "matrix"; head: string[]; rows: { label: string; allowed: boolean[] }[] }
  | {
      type: "params";
      rows: { name: string; kind: string; text: string; required?: boolean; hint?: string }[];
    }
  | { type: "faq"; items: { q: string; a: string }[] }
  | { type: "notes"; items: { icon: NoteIcon; text: string }[] }
  | { type: "figure"; name: FigureName };

export interface DocPage {
  /** URL path under /docs; "" is the /docs index itself. */
  slug: string;
  title: string;
  /** The page title is set in mono, as for the tool pages. */
  mono?: boolean;
  /** The one-line summary under the title, also used by search. */
  lede: string;
  group: DocsGroup;
  minutes?: number;
  badge?: { label: "WRITES" | "READ-ONLY"; facts: string[] };
  blocks: Block[];
}

export interface DocsGroupInfo {
  id: DocsGroup;
  label: string;
}

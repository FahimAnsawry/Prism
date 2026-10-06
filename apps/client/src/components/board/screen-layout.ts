// create_screen (tools.md §6): an AI editor's layout tree is laid out here when a board tab is
// open, so text is measured and wrapped exactly as the board will draw it.

import {
  buildMindMap,
  layoutFonts,
  type LayoutMindmapRequest,
  layoutScreen,
  type LayoutScreenReply,
  type LayoutScreenRequest,
} from "@prism/shared";
import { loadFonts } from "./fonts";
import { boardMeasure, resetMeasurements } from "./text-layout";

/** Answers a layout request. Never throws: failures become a reply. */
export async function layoutScreenOnTab(request: LayoutScreenRequest): Promise<LayoutScreenReply> {
  try {
    await loadFonts(layoutFonts(request.root, request.options.font));
    // Widths taken before the fonts arrived used a fallback font.
    resetMeasurements();
    return { ok: true, elements: layoutScreen(request.root, request.options, boardMeasure) };
  } catch (error) {
    console.error("[Prism] Screen layout failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "Layout failed.",
    };
  }
}

/** The fonts and weights mind map nodes use, by level. */
const MIND_WEIGHTS = [400, 600, 700];

/** Answers a create_mindmap sizing request. Never throws: failures become a reply. */
export async function layoutMindmapOnTab(
  request: LayoutMindmapRequest,
): Promise<LayoutScreenReply> {
  try {
    await loadFonts(MIND_WEIGHTS.map((weight) => [request.options.font, weight] as const));
    resetMeasurements();
    return { ok: true, elements: buildMindMap(request.nodes, request.options, boardMeasure) };
  } catch (error) {
    console.error("[Prism] Mind map layout failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 500) : "Layout failed.",
    };
  }
}

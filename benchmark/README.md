# Prism design benchmark

A fixed design prompt for checking Prism's output while Prism is being improved. After each roadmap phase, Prism designs the same two screens again, so the results can be compared with earlier phases.

Comparing with other tools is manual and on request: build the same demo in Miro, MagicPath or any other tool, then ask for a comparison. The comparison uses the criteria below and ends with the fixes Prism needs, if any.

## Design prompt

Give each tool this text exactly, with nothing added:

> Design two screens for **Tallyway**, a SaaS tool that helps small finance teams collect, approve and pay supplier invoices.
>
> 1. **Desktop landing page** (1440 wide): navigation, a hero with the product shown, social proof, three key features, a testimonial, a final call to action and a footer. Primary goal: get visitors to start a free trial.
> 2. **Mobile app screen** (390 × 844): the "Approvals" inbox, where a finance manager sees invoices waiting for approval (supplier, amount, due date, status) and can approve or open one. Include the app's tab bar.
>
> Make it look like a real, polished product: a clear hierarchy, consistent spacing and type, one accent color, realistic copy and numbers.

**Reference source:** none

## Reference set

The design prompt names no reference source, so this benchmark uses no references. If a later version of the prompt names a source (Mobbin, Dribbble, given URLs, a site, …), take references only from that source. Look at as many screens as you need, keep the ones that inform the design, and list each one here with its image URL and a one-line note on what to take from it.

## Prism runs

All runs live on one Prism board, **Benchmark: Phase 0 baseline** (http://localhost:5173/board/f3a360cc-eb94-49c2-84c9-a0cb1de68b52), not as files in the repo. After each roadmap phase, an AI editor runs the design prompt in Prism through the `prism` MCP server (`open_board`, `get_design_guide`, `create_screen`, then fix its warnings and check with `export_image`). It places the new frames to the right of the earlier ones, with a sticky note naming the phase.

| Phase | Notes |
| --- | --- |
| 0 (baseline) | Avatars are plain circles (no real images). The landing page was laid out before a board tab was open, so the text sizes were estimated: the quote wrapped badly (fixed by hand) and the hero paragraph ends with "days, not weeks." on its own line, with no warning. The palette check counted status chips as accent colors. |

## Comparing with another tool

1. Build the design prompt in the other tool and export its screens.
2. Add the screenshots to the benchmark board next to Prism's frames (`add_image`), or share them directly, and ask for a comparison with Prism's latest run.
3. The answer scores both runs on the criteria below, says which is more accurate and polished, and lists the fixes Prism needs, ordered by impact.

## Criteria

Each screen is scored 1–5 on each point:

- **Hierarchy:** one obvious focal point per section; the eye follows the intended path.
- **Typography:** a clear, consistent type scale; well-set headlines; readable line lengths; no bad wraps.
- **Spacing and alignment:** one spacing rhythm; everything sits on the content column and grid.
- **Color:** one accent used with intent, neutrals carrying the page, good contrast.
- **Imagery:** a believable product UI and real-looking photos, avatars and logos instead of gray boxes.
- **Fidelity to the references:** takes their structure and density without copying their brand (N/A when there are no references).
- **Editability:** named, grouped components that a person, or code, can change easily.

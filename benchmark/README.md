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

| Phase                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 (baseline)                 | Avatars are plain circles (no real images). The landing page was laid out before a board tab was open, so the text sizes were estimated: the quote wrapped badly (fixed by hand) and the hero paragraph ends with "days, not weeks." on its own line, with no warning. The palette check counted status chips as accent colors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8                            | Each screen drawn twice from one design: as a layout tree (`root`) and as HTML + Tailwind (`html`); the two came out nearly identical. Scores rose from 23 to 27 of 30 per screen, mostly from imagery (a real testimonial photo, drawn avatars, SVG wordmarks, a product window with a floating card) and steadier spacing and color. All four frames ended with no warnings after one round of fixes (headline wrap, quote breaks, 12 → 8 text sizes, contrast). Still wrong: the lead paragraph ends with "ten." on its own line, with no warning; the HTML path drew a centered two-line section title left-aligned (fixed with update_elements); in the layout tree a full-width box inside a hugging stack pushed the window's tabs out of it. The split hero's product window (about 620 wide) sells the product less than Phase 0's 1100-wide window.                                                                                                                                                                                                                                                                                                                                                  |
| Anti-slop guide (experiment) | `get_design_guide` rewritten with impeccable's anti-slop rules (name the category default first, a Refuse list, color strategies, a font blocklist, a looser landing recipe, a two-round check limit); layout tree only. Phase 8's landing page was the category default the new guide names: an eyebrow pill, Inter, a split hero with a floating "$184,320 +12%" card, three icon cards, a stats row, a navy CTA band. The new run built a ledger-pad world instead: committed pale green with ledger rules, Schibsted Grotesk, a real supplier invoice with an approval stamp next to its approval trail, the three features as one Collect → Approve → Pay sequence with a UI fragment each, a large quote, and a close on the same ledger field. Landing scores 26 of 30 on the old criteria (imagery is a drawn document rather than an app window; the hero has empty field under the invoice); Distinctiveness 4 of 5 against Phase 8's 1. Mobile changed little, as intended (familiar list rows instead of cards). Round one still shipped a dark CTA band, caught only by the guide's new slop check. Caveats: one run, by the same model that wrote the guide; no lint enforces the new rules yet. |

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
- **Distinctiveness:** the look couldn't be guessed from the category alone; it avoids the category's default parts (a label above the headline, same-size icon cards, a stats row or floating metric card, gradient text, the overused fonts) unless the prompt asks for them, and has one idea only this product could own.

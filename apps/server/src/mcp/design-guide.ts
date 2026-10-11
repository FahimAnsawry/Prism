// The design guide get_design_guide returns: how a screen should look before it is drawn. Tool
// descriptions say how to call Prism; this says what good looks like, so an AI editor doesn't
// fall back on small, dense, many-colored defaults.

export const DESIGN_SURFACES = ["landing", "app", "mobile"] as const;
export type DesignSurface = (typeof DESIGN_SURFACES)[number];

const BEFORE = `# Prism design guide

Read this before the first screen. It sets the quality bar; the project theme (get_theme) and the user's requests come first wherever they differ.

A website is one design, and different websites are different designs. Called with a boardId, this guide ends with a "This site" section: the screens the board's site already has, whose language every new page keeps, or, for a new site, how the user's other sites look, so this one doesn't come out as the same page again. Read it again with the boardId whenever you move to another board.

## 1. Decide before you draw

Answer these in two or three lines each, then design from the answers:
- Category default: one line naming the page this category always ships (for a B2B SaaS landing page: an eyebrow pill over a two-line headline, Inter everywhere, a product window with a floating metric card, a logo strip, three icon cards, a stats row, a smiling portrait beside a quote, a brand-color CTA band). That is the design to avoid, not the starting point. If someone could guess your design from the category alone, rework it.
- Directions: on a new site, two or three genuinely different directions: the obvious fit and at least one less obvious but defensible one (the table below has starting points). Compare them on audience, content and composition, then choose one on purpose. Not at random, and not the first just because it came first.
- Thesis: one sentence on what this screen must make the viewer feel and do, and the category-default arrangement it refuses.
- Signature move: the one visual idea only this product could own, drawn from what it actually does (its real artifact, workflow or data at full scale), not from a pattern library.
- Scene: one sentence on who uses it, where and in what light. It decides light or dark; the category never does.
- From each reference: the structure, hierarchy and density you are taking, never its brand, logo or copy. Mixing two references in one design is good.
- Color strategy (section 3), then the palette.
- Type: one family (or one display face plus one text face) and the sizes below.

Three looks AI-made screens fall into whatever the subject: (a) warm cream ground, high-contrast serif display, a terracotta or red accent; (b) near-black with one neon accent and glowing edges; (c) editorial hairlines, italic display serif, small tracked mono labels. Use one only when the brief asks for it.

Directions to start from. They are not themes: each is anchored in physical things, so the palette, type and layout come from one idea. Adapt one or invent one from the product's own world (its materials, place and light) when none fits:
| Direction | Made of | Ground × accent | Type and composition |
| --- | --- | --- | --- |
| Ledger Room | ruled ledgers, green baize, brass | paper white × bottle green | tabular figures, ruled columns, dense right-aligned numbers |
| Dry Dock | hull paint, steel plate, chalk marks | steel gray × hull red | condensed grotesk, outsized numerals, heavy horizontal bands |
| Transit Map | enamel signs, line colors, platform tiles | white × three or four line colors | geometric sans, a route diagram as the page's structure |
| Lab Notebook | graph paper, pencil, blue ink | grid white × ink blue | the grid as structure, figures with captions, sparse margin notes |
| Post Office | kraft envelopes, airmail stripes, stamp ink | kraft × airmail red and blue | slab serif labels, tickets and envelopes as containers |
| Pool Hall | glazed tiles, chlorine blue, lane ropes | tile white × pool blue at scale | rounded geometric sans, tiled grids, lane-like rhythm |
| Print Shop | risograph overprint, newsprint | newsprint × fluorescent pink and teal | heavy grotesk, poster-scale type, overprinted blocks |
| Market Stall | chalkboards, crate wood, citrus | chalkboard green × citrus yellow | hand-lettered display, price-tag chips, playful crops |
| Observatory | star charts, brass fittings, night sky | midnight blue × brass | thin geometric sans, fine-ruled diagrams, wide margins |
| Pharmacy | white counters, labeled drawers, the green cross | white × pharmacy green | sturdy sans labels, a drawer-like modular grid |
| Field Station | olive canvas, topo maps, survey tape | olive × survey orange | contour patterns, coordinates as captions, stacked field cards |
| Archive | gray boxes, typed labels, red pencil | archive gray × red pencil | catalogue numbers, index-card layout, typed metadata |
Two sites in similar colors must still differ in composition: how the page opens, where the product sits, its density, and how it ends.

Before the first create_screen of a new site, post a short brief in chat: the directions you weighed and the one you chose (with a sentence tying it to this product and audience), the palette with roles (background, surface, text, muted text, accent, border), the type, the page structure and the signature move. It commits you to a direction; it is not a question, so carry on without waiting for a reply. Skip it on a site that already has screens: those set the direction.

## Refuse

These are the category's defaults. The user's request can ask for any of them, and then you draw it well; otherwise leave them out:
- A small label, pill or kicker above a heading ("New: …", "FEATURES", "How it works"). The heading carries its own weight.
- Same-size cards of icon chip + title + two lines as a page's structure, and cards inside cards.
- The hero-metric template: a big number with a small label, a stats row, a floating "+12%" card.
- Section numbers (01 / 02 / 03) unless the order is information the reader needs.
- Gradient text. Emphasis comes from size and weight.
- Frosted glass, glows and gradients as decoration rather than a specific effect.
- A colored border thicker than 1px down one side of a card, row or callout.
- Hard offset shadows (x/y with no blur) and zero-offset colored halos.
- Monospace as a "technical" costume rather than for code, data or measurement.
- Emoji or Unicode symbols as icons.
- The landing-page kit: a product window under the headline, a logo strip, a smiling stock portrait beside a quote, a full-width brand-color band with a button before the footer. Take one part when this product needs it, never the set.
On app and mobile screens familiarity is a feature: standard controls, one UI family, the usual navigation. The list still applies to their decoration.`;

const SYSTEM = `## 2. Type

Desktop marketing (1440 frames):
| Role | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- |
| Hero headline | 64-80 | 700-800 | 1.05 | -0.03 |
| Section title | 40-48 | 700 | 1.1 | -0.02 |
| Card / item title | 20-24 | 600 | 1.3 | -0.01 |
| Lead paragraph | 18-22 | 400 | 1.55 | 0 |
| Body | 16-17 | 400 | 1.5 | 0 |
| Small, labels | 14 | 500 | 1.4 | 0 |
| Caption, table header | 12-13 | 500-600 | 1.3 | 0.06 uppercase |

- Never below 12px. Product mocks inside a page may use 13-14px for table text; that is the floor.
- At most 3 sizes per section, and the same role always gets the same size.
- Headlines: 2 lines at most, about 8 words, broken by hand with \\n where the phrase breaks. Paragraphs: 520-640px wide (60-75 characters per line).
- With a strict theme, use its text styles ($display, $h1-$h4, $body-lg, $body, $body-sm, $caption, $label) instead of sizes.
- Letter spacing never below -0.04; -0.02 to -0.03 reads better on big headings.
- Fonts: any Google Font as gf:<Name>, or the board fonts (inter, sans = DM Sans, poppins, montserrat, lato, playfair, merriweather). App and mobile screens are well served by one workhorse UI sans. A landing page wants a face with a point of view, chosen like an object from the product's world. These are what every AI-made page uses, so pick one only for a reason no other face meets: Inter or DM Sans as display, Plus Jakarta Sans, Outfit, Space Grotesk, Syne, IBM Plex, Instrument Sans, Fraunces, Playfair Display, Cormorant, Lora, Newsreader. A serif display over a sans body is not a signature on its own.

## 3. Color

Pick a strategy before picking colors:
- Restrained: neutrals carry the page, one accent for actions, selection and state. The default for app and mobile screens.
- Committed: one saturated color owns 30-60% of the surface, as whole regions (a hero field, a full-bleed band), not scattered accents.
- Full palette: 3-4 named color roles, each owning its regions.
- Drenched: the surface is the color.
A landing page may take any of them; choose from the thesis and scene, not out of caution. "One accent color" in a brief still allows Committed or Drenched: one hue, used at scale.

Then:
- Neutrals: near-black ink for headings, a muted body color, one or two surfaces, hairline borders. Tint them toward the main hue when that hue owns the page; on a colored field, derive secondary text from that hue rather than a generic gray.
- Never two loud accents on one page.
- Meaning colors (green success, red error, amber warning, blue info) only on status chips and charts, as a faint fill with the same family's dark text.
- Text on any fill passes WCAG AA: 4.5:1 for body, 3:1 for 24px+ or bold 19px+.

## 4. Space and size

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Nothing in between.
- Desktop content column: 1200-1280 wide (padding 80-120 on a 1440 frame), every section aligned to it.
- Section padding: 96-128 top and bottom on desktop, 64 on mobile. Heading to its paragraph 16-24, text block to its visual 48-64. Always more space above a heading than below it.
- Vary density down the page: a dense passage earns a quiet one. Not every section is the same title, lead and grid.
- Siblings are identical: same card size, padding, gap and treatment; differences go in a small chip or label.
- Buttons 44-52px tall (padding about 14 x 24), inputs 44-48px, one radius family (e.g. 8 buttons and inputs, 16 cards, 24 big panels).
- Cards: padding 24-32, a hairline border or a soft shadow, never both, radius 12-16. Pills are for small controls and chips. Shadows have a y offset and a soft blur.
- Leave air: a section looks finished when it has room around it, not when every gap is filled.`;

const LANDING = `## 5. Landing page recipe

A landing page is a whole page, usually 2400-4000px tall in one 1440 frame. What it must do is fixed; its order and form are not. Pick a structure from the product and the story it tells, name it before you draw, and don't reuse the structure of the user's other sites ("This site" lists them).

A landing page has jobs, not a fixed list of sections. Each job takes the form this product's content asks for; the forms named here are examples, not a checklist:
- Navigation (64-80px): logo, a few links, the primary action. It may sit inside the hero's color field rather than on white with a hairline.
- A first viewport that is a thesis, not a header: the offer clear, the primary action visible, a trust line; no label above the headline. Its form varies: the product at full scale, a typographic statement, a photo from the customer's world, something to try, the sign-up form itself. A product window under the headline is the category default: use it when the product's interface is the point, and not when the user's other sites already open that way ("This site" says). Ask: if someone left after this viewport, what would they describe an hour later? If the answer is a mood, it is not decided yet.
- The product, believable: plausible names and numbers, never a small window beside the copy (960+ wide, or full-bleed and cropped). Annotate it, zoom into one detail, or show two states of it; do not float a metric card on it. It may lead the page or arrive once the problem is set up.
- Evidence, only when there is something specific to show: a customer's before and after, a real-looking document or export, an integration list, a changelog, a named quote. Keep endorsements clearly fictional demo content. A quote beside a smiling stock portrait is the most generic form; the customer's work (their shop floor, their document) or a drawn avatar says more. A row of big numbers is the template; use one only when the brief asks for metrics.
- The key features, in the form their content asks for: a workflow reads as one continuous sequence drawn across the page; capabilities of one screen read as callouts on a large product view; unlike features read as text and visuals at different sizes. Three same-size icon cards only when the items really are equivalent and nothing better fits; then make each card show its feature (a fragment of UI) instead of an icon chip.
- An ending that hands the reader their next step: the sign-up form or pricing itself, the product's finished state, a short FAQ that answers the last objection, or the action set into the footer. A full-width brand-color band with a headline and a button is the category default: use it only when nothing else fits and the user's other sites don't already end that way.
- A footer: logo, link columns, legal line.

Structures (pick one, mix two, or invent one; the usual nav, product hero, logo strip, alternating feature rows, testimonial and CTA band is the one to avoid):
- Artifact first: the product's real artifact (an invoice moving through approval, a schedule filling up) at full scale in the first viewport, the headline set against it, features as callouts on it.
- One story: a single customer followed from the problem to the result, the product appearing where it changes the outcome.
- Before and after: the old way and the new way, the whole page built on the contrast.
- Walkthrough: one workflow drawn down the page as a continuous path, each step a stop on it.
- Editorial: a long read that opens with an argument, the product shown in figures between passages.
- Offer first: pricing or the sign-up form near the top, for a product people already understand; the rest answers objections.
- Live demo: the first viewport is the product in use with something to try; the page below it is short.`;

const APP = `## 5. App screen recipe

1. Shell: a left sidebar (240-280 wide: workspace switcher, search, 6-8 nav items with icons, active item on a faint accent fill) or a top bar.
2. Page header: title (24-30px), one line of description, actions on the right (secondary, then primary).
3. Content on a clear grid: KPI cards in a row, then the main table, board or chart. Tables: 44-52px rows, 13-14px text, a header row in muted small text, status as chips, numbers right-aligned.
4. Realistic data everywhere: names, companies, amounts, dates. Never "Item 1" or lorem ipsum.
5. Each meaningful state (empty, loading, error, filled) is its own frame next to the main one.`;

const MOBILE = `## 5. Mobile screen recipe

1. Frame 390 x 844. Side padding 20-24, a status-bar gap at the top (about 47px), a home-indicator gap at the bottom.
2. Type: headline 28-34, body 16, small 14; nothing under 12.
3. Touch targets at least 44px tall; the primary action full width, pinned to the bottom with a flexible spacer when the frame height is fixed.
4. One column. Group content in cards or plain sections with 24-32 between them.
5. Navigation: a tab bar (4-5 items, icon plus label) or a top bar with back and title.`;

const BUILD = `## 6. Building it in Prism

- One create_screen per frame. A whole landing page fits in one call (up to 800 nodes).
- Two ways to write it: a layout tree (root), or HTML + Tailwind (html), which the board tab renders and reads back. Use whichever you write better; HTML suits dense marketing pages and anything you'd reach for flex, grid or absolute positioning for. In HTML:
  - Theme classes keep the screen on the theme and come back as $tokens: bg-primary text-primary-foreground, bg-card, bg-muted, text-muted-foreground, border-border, rounded-md/lg/xl, text-display/h1/h2/h3/h4/body-lg/body/body-sm/caption/label, font-heading. A strict theme refuses palette colors (bg-blue-500), arbitrary sizes and padding or gaps off its spacing steps.
  - Icons: <i data-icon="arrow-right" class="size-4 text-primary"></i> (add fill-amber-400 for a solid star). Photos: <img src="…from search_images" class="h-80 w-full rounded-2xl object-cover">. Avatars: <img data-avatar="Maya Okafor" class="size-10 rounded-full">. Logos and illustrations: inline <svg>, colored with fill-*/stroke-* classes.
  - Components: <x-use component="Button" variant="ghost" label="Cancel"></x-use>; children fill the component's slot.
  - data-name="Hero" makes an element and its contents one group; data-role="card" says what it is. absolute elements are layers (a caption card hanging off a photo: relative parent, absolute -bottom-8 -left-10 child).
  - Not drawn: ::before/::after content, video, canvas.
  - Example: <form data-name="Sign up" data-role="form" class="flex w-[560px] items-center gap-2 rounded-lg border border-border bg-card p-2"><span class="flex-1 px-3 text-body text-muted-foreground">you@company.com</span><a data-role="button" class="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-label text-primary-foreground">Start free <i data-icon="arrow-right" class="size-4"></i></a></form>
- Stack children stretch to the full width by default. Put badges, pills, icon chips and buttons in a row (or set align: "start" on the stack) so they hug their content.
- Give big headlines room: put \\n where the line should break and make sure the container is wide enough, or it wraps into extra lines.
- Layering (a detail zoomed out of a product window, a badge on an avatar, a headline over a photo): an overlay container. Its first child is the base and sets its size; later children draw on top, each placed by anchor (top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right) and x/y in px, negative to hang past an edge. A product window with one of its rows enlarged off its bottom-left: { type: "overlay", children: [ { type: "stack", name: "Product window", … }, { type: "stack", name: "Row detail", anchor: "bottom-left", x: -32, y: 32, width: 360, padding: 20, fill: "#ffffff", radius: 16, shadow: "lg", children: [ … ] } ] }.
- Charts: create_elements type chart. A standalone picture: add_image.
- Paint, on containers and boxes (and rect/frame elements):
  - image: { url, fit: "cover" } puts a photo inside the shape, clipped to its radius: hero photos, card covers, avatars (a box with shape "ellipse"). Prism downloads it.
  - radius per corner: [16, 16, 0, 0] for a cover photo on top of a card.
  - gradient: { type: "linear", angle: 135, stops: [{ color: "$primary", position: 0 }, { color: "#1e3a8a", position: 100 }] } only when it is a specific effect (light falling across a field), within one hue; a flat field of color usually reads stronger.
  - shadow as soft layers instead of a preset, like CSS box-shadow: [{ x: 0, y: 24, blur: 48, spread: -12, color: "#0f172a26" }].
  - backdropBlur: 16 with a semi-transparent fill (#ffffffb3) and a hairline stroke, only where text must sit on a busy photo.
- Imagery: never leave a gray box where a picture belongs (create_screen warns about them).
  - Photos: the user's own images first (on the board, or URLs they gave). Otherwise search_images with the boardId and a query from this product's world, specific about subject and light ("freight depot loading bay at dawn", "dentist chair by a window", "hands sorting seed packets"), never a generic office or a smiling portrait; the boardId leaves out photos the user's other sites already use. Choose by subject, crop, light and palette, not by rank, then image: { url } with fit cover. When nothing fits, a typographic treatment beats a stock photo. Results are free to use; for a CC BY one, show its credit line in a small caption or the footer.
  - People: avatar: "Maya Okafor" on an ellipse box gives a consistent drawn face (the same name, the same face). For a testimonial, a drawn avatar or a photo of the customer's work usually says more than a stock portrait; use a portrait only when the person is the point.
  - Logos: fictional SVG wordmarks (svg on a box): a simple mark plus a name, each in a different typeface or weight, all in one muted color. Never a real company's logo. Text in an SVG uses the viewer's system fonts (Arial, Georgia, Courier New, …), so name a generic fallback and leave a third of spare width in the viewBox.
  - Illustrations, empty states, patterns and blobs: SVG in the theme's colors.
  - The product itself stays drawn UI (a window with a real table, chart or board), not a photo of a screen.
- Name every component (one groupId) and give it a role, so build_pages can code it. To code a screen, read it with get_screen_code (nested layout, sizes, tokens and component instances) rather than get_board's flat elements, and get_theme in the app's format (css for Tailwind, css-vars for plain CSS, dart for Flutter).

## 7. Check it

1. create_screen returns warnings (text that wraps more than written, content spilling out of its container or frame, low contrast, tiny text, too many sizes or accent colors, side-by-side cards of different heights, blocks just off the main column, a rating of outline-only stars, gray boxes standing in for images). Fix each with update_elements or redraw the section; ignore one only when it is intended. Status chips and charts may use their own colors.
2. export_image the frame and critique it against your thesis and the references: one focal point per section, everything on the content column, equal sibling spacing, readable contrast, nothing cramped, nothing orphaned. Then the slop check: go through the Refuse list; swap the product's name for an unrelated one, and if the page still fits, its composition, copy or signature move is too generic; ask whether someone could guess this design from the category alone, or mistake it for another of the user's sites (or, on a site with screens, for a page from a different site): compare how it opens, proves and ends with the patterns "This site" lists for them. Fix everything in one batch and look once more; two rounds is the ceiling.
3. When the screen follows a reference image on the board, run compare_reference (frameId, referenceId) and fix the differences that matter: layout and tone usually, not the reference's brand colors. Compare again after fixing.
4. Tell the user the thesis, the direction and structure you chose and what you took from each reference.`;

const RECIPES: Record<DesignSurface, string> = { landing: LANDING, app: APP, mobile: MOBILE };

/** The guide for a surface, ending with the board's "This site" section (site-context.ts) if given. */
export function designGuide(surface: DesignSurface, site?: string) {
  return [BEFORE, SYSTEM, RECIPES[surface], BUILD, site].filter(Boolean).join("\n\n");
}

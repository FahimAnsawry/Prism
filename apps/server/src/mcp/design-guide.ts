// The design guide get_design_guide returns: how a screen should look before it is drawn. Tool
// descriptions say how to call Prism; this says what good looks like, so an AI editor doesn't
// fall back on small, dense, many-colored defaults.

export const DESIGN_SURFACES = ["landing", "app", "mobile"] as const;
export type DesignSurface = (typeof DESIGN_SURFACES)[number];

/** Directions shown per call: a few at random, so no row becomes the new default. */
const DIRECTIONS_SHOWN = 4;

// [name, made of, ground × accent, type and composition]
const DIRECTIONS: [string, string, string, string][] = [
  [
    "Ledger Room",
    "ruled ledgers, green baize, brass",
    "paper white × bottle green",
    "tabular figures, ruled columns, dense right-aligned numbers",
  ],
  [
    "Dry Dock",
    "hull paint, steel plate, chalk marks",
    "steel gray × hull red",
    "condensed grotesk, outsized numerals, heavy horizontal bands",
  ],
  [
    "Transit Map",
    "enamel signs, line colors, platform tiles",
    "white × three or four line colors",
    "geometric sans, a route diagram as the page's structure",
  ],
  [
    "Lab Notebook",
    "graph paper, pencil, blue ink",
    "grid white × ink blue",
    "the grid as structure, figures with captions, sparse margin notes",
  ],
  [
    "Post Office",
    "kraft envelopes, airmail stripes, stamp ink",
    "kraft × airmail red and blue",
    "slab serif labels, tickets and envelopes as containers",
  ],
  [
    "Pool Hall",
    "glazed tiles, chlorine blue, lane ropes",
    "tile white × pool blue at scale",
    "rounded geometric sans, tiled grids, lane-like rhythm",
  ],
  [
    "Print Shop",
    "risograph overprint, newsprint",
    "newsprint × fluorescent pink and teal",
    "heavy grotesk, poster-scale type, overprinted blocks",
  ],
  [
    "Market Stall",
    "chalkboards, crate wood, citrus",
    "chalkboard green × citrus yellow",
    "hand-lettered display, price-tag chips, playful crops",
  ],
  [
    "Observatory",
    "star charts, brass fittings, night sky",
    "midnight blue × brass",
    "thin geometric sans, fine-ruled diagrams, wide margins",
  ],
  [
    "Pharmacy",
    "white counters, labeled drawers, the green cross",
    "white × pharmacy green",
    "sturdy sans labels, a drawer-like modular grid",
  ],
  [
    "Field Station",
    "olive canvas, topo maps, survey tape",
    "olive × survey orange",
    "contour patterns, coordinates as captions, stacked field cards",
  ],
  [
    "Archive",
    "gray boxes, typed labels, red pencil",
    "archive gray × red pencil",
    "catalogue numbers, index-card layout, typed metadata",
  ],
];

function directionRows() {
  const rows = [...DIRECTIONS];
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j]!, rows[i]!];
  }
  return rows
    .slice(0, DIRECTIONS_SHOWN)
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

const HEADER = `# Prism design guide

Read this before the first screen. It sets the quality bar; the project theme (get_theme) and the user's requests come first wherever they differ.

A website is one design, and different websites are different designs. Called with a boardId, this guide ends with a "This site" section: the screens the board's site already has, whose language every new page keeps, or, for a new site, how the user's other sites look, so this one doesn't come out as the same page again. Read it again with the boardId whenever you move to another board.`;

const DECIDE_LANDING = () => `## 1. Decide before you draw

Answer these in two or three lines each, then design from the answers:
- Category default: one line naming the page this category always ships (for a B2B SaaS landing page: an eyebrow pill over a two-line headline, Inter everywhere, a product window with a floating metric card, a logo strip, three icon cards, a stats row, a smiling portrait beside a quote, a brand-color CTA band). That is the design to avoid, not the starting point. If someone could guess your design from the category alone, rework it.
- Directions: on a new site, two or three genuinely different directions: the obvious fit and at least one less obvious but defensible one. Compare them on audience, content and composition, then choose one on purpose. Not at random, and not the first just because it came first.
- Thesis: one sentence on what this screen must make the viewer feel and do, and the category-default arrangement it refuses.
- Signature move: the one visual idea only this product could own, drawn from what it actually does (its real artifact, workflow or data at full scale), not from a pattern library.
- Scene: one sentence on who uses it, where and in what light. It decides light or dark; the category never does.
- From each reference: the structure, hierarchy and density you are taking, never its brand, logo or copy. Mixing two references in one design is good.
- Color strategy (section 4), then the palette.
- Type: one family (or one display face plus one text face) and the sizes in section 3.

Three looks AI-made screens fall into whatever the subject: (a) warm cream ground, high-contrast serif display, a terracotta or red accent; (b) near-black with one neon accent and glowing edges; (c) editorial hairlines, italic display serif, small tracked mono labels. Use one only when the brief asks for it.

Find a direction in the product's own world first: its materials, its place, its light, the objects its users handle. Each direction is anchored in physical things, so the palette, type and layout all come from one idea. A few worked examples of the method (a different few each time you read this; they show how, they are not a menu):
| Direction | Made of | Ground × accent | Type and composition |
| --- | --- | --- | --- |
${directionRows()}
Two sites in similar colors must still differ in composition: how the page opens, where the product sits, its density, and how it ends.

Before the first create_screen of a new site, post a short brief in chat: the directions you weighed and the one you chose (with a sentence tying it to this product and audience), the palette with roles (background, surface, text, muted text, accent, border), the type, the page structure and the signature move. It commits you to a direction; it is not a question, so carry on without waiting for a reply. Skip it on a site that already has screens: those set the direction.`;

const DECIDE_PRODUCT = () => `## 1. Decide before you draw

Product screens are used, not admired: familiarity is a feature. Standard controls, one UI family, the usual navigation for the platform. Answer these in a line each, then design from the answers:
- Person and task: who opens this screen and the one thing they came to do. That task gets the most size, contrast and the primary action.
- Density: scanning many items (tight rows, small type, more columns) or deciding on one (more air, larger type, fewer things).
- States: which of empty, loading, error and filled this screen needs as frames (section 7).
- Theme: the project theme's colors, type and radius. Without one, a Restrained palette (section 4) and one workhorse UI sans.
- From each reference: the structure, hierarchy and density you are taking, never its brand, logo or copy.

The Refuse list (section 2) still applies to a product screen's decoration. Where the product has a marketing site on this board's project, its screens share the theme and components, not the landing page's display type or drama.`;

const REFUSE = `## 2. Refuse

These are the category's defaults. The user's request can ask for any of them, and then you draw it well; otherwise leave them out:
- A small label, pill or kicker above a heading ("New: …", "FEATURES", "How it works"). The heading carries its own weight.
- Same-size cards of icon chip + title + two lines as a page's structure, and cards inside cards.
- The hero-metric template: a big number with a small label, a stats row, a floating "+12%" card. (A dashboard's KPI row is not this: there the numbers are the content.)
- Section numbers (01 / 02 / 03) unless the order is information the reader needs.
- Gradient text. Emphasis comes from size and weight.
- Frosted glass, glows and gradients as decoration rather than a specific effect.
- A colored border thicker than 1px down one side of a card, row or callout.
- Hard offset shadows (x/y with no blur) and zero-offset colored halos.
- Monospace as a "technical" costume rather than for code, data or measurement.
- Emoji or Unicode symbols as icons.
- The landing-page kit: a product window under the headline, a logo strip, a smiling stock portrait beside a quote, a row of big numbers, a full-width brand-color band with a button before the footer. Take one part when this product needs it, never the set, and not the part the user's other sites already use ("This site" says).`;

const TYPE_HEAD = `| Role | Size | Weight | Line height | Letter spacing |
| --- | --- | --- | --- | --- |`;

const TYPE_SCALES: Record<DesignSurface, string> = {
  landing: `Desktop marketing (1440 frames; section 8 says how it shrinks at 390):
${TYPE_HEAD}
| Hero headline | 64-80 | 700-800 | 1.05 | -0.03 |
| Section title | 40-48 | 700 | 1.1 | -0.02 |
| Card / item title | 20-24 | 600 | 1.3 | -0.01 |
| Lead paragraph | 18-22 | 400 | 1.55 | 0 |
| Body | 16-17 | 400 | 1.5 | 0 |
| Small, labels | 14 | 500 | 1.4 | 0 |
| Caption, table header | 12-13 | 500-600 | 1.3 | 0.06 uppercase |`,
  app: `Desktop app (1440 frames). Denser than marketing: people read it all day.
${TYPE_HEAD}
| Page title | 24-30 | 600-700 | 1.2 | -0.02 |
| Key number (a KPI) | 28-36 | 600 | 1.1 | -0.02 |
| Section / card title | 16-20 | 600 | 1.3 | -0.01 |
| Body, table text | 14 | 400 | 1.5 | 0 |
| Small, labels, buttons | 13-14 | 500 | 1.4 | 0 |
| Caption, table header | 12 | 500 | 1.3 | 0 (0.06 if uppercase) |`,
  mobile: `Mobile (390 frames):
${TYPE_HEAD}
| Large title | 28-34 | 700 | 1.15 | -0.02 |
| Title, sheet header | 20-22 | 600 | 1.25 | -0.01 |
| Row / card title | 16-17 | 600 | 1.3 | 0 |
| Body | 16 | 400 | 1.45 | 0 |
| Secondary, footnote | 13-15 | 400 | 1.35 | 0 |
| Caption, tab label | 12 | 500 | 1.3 | 0 |`,
};

const system = (surface: DesignSurface) => `## 3. Type

${TYPE_SCALES[surface]}

- 12px is the floor for any text. A product mock inside a page may set its body text at 13-14px.
- At most 3 sizes per section, and the same role always gets the same size.
- Headlines: 2 lines at most, about 8 words, broken by hand with \\n where the phrase breaks. Paragraphs: 520-640px wide (60-75 characters per line).
- With a strict theme, use its text styles ($display, $h1-$h4, $body-lg, $body, $body-sm, $caption, $label) instead of sizes.
- Letter spacing never below -0.04; -0.02 to -0.03 reads better on big headings.
- Weight: headings 600-700 over 400 body. Nothing under 400 below 20px; light weights only at display sizes. Bold inside a paragraph marks one or two things, not every term.
- Line height falls as size rises: body 1.5-1.6, about 1.3 at 32-40px, 1.05-1.15 at display sizes. Body never above 1.75, headings never above 1.3.
- Long text: break anything over four or five lines into short paragraphs, or a list under small subheadings. Left-align it; center only a headline, one or two lines under it and a button.
- All caps only for short labels (captions, table headers), never on buttons, badges or a sentence.
- Fonts: any Google Font as gf:<Name>, or the board fonts (inter, sans = DM Sans, poppins, montserrat, lato, playfair, merriweather). App and mobile screens are well served by one workhorse UI sans. A landing page wants a face with a point of view, chosen like an object from the product's world. These are what every AI-made page uses, so pick one only for a reason no other face meets: Inter or DM Sans as display, Plus Jakarta Sans, Outfit, Space Grotesk, Syne, IBM Plex, Instrument Sans, Fraunces, Playfair Display, Cormorant, Lora, Newsreader. A serif display over a sans body is not a signature on its own.

## 4. Color

Pick a strategy before picking colors:
- Restrained: neutrals carry the page, one accent for actions, selection and state. The default for app and mobile screens.
- Committed: one saturated color owns 30-60% of the surface, as whole regions (a hero field, a full-bleed band), not scattered accents.
- Full palette: 3-4 named color roles, each owning its regions.
- Drenched: the surface is the color.
A landing page may take any of them; choose from the thesis and scene, not out of caution. "One accent color" in a brief still allows Committed or Drenched: one hue, used at scale.

Then:
- Neutrals: near-black ink for headings (never pure #000000 on white), body text a step lighter, one or two surfaces, hairline borders. On dark grounds, headings off-white and body a step dimmer, never pure #ffffff for both. Tint them toward the main hue when that hue owns the page; on a colored field, derive secondary text from that hue rather than a generic gray.
- Never two loud accents on one page.
- The accent marks what can be clicked or is selected: the primary action, links, the active item. Spread over headings, icons and backgrounds, it stops meaning anything.
- Status colors (green success, red error, amber warning, blue info) keep their meaning, tuned to the palette but never swapped: a Delete button is red, never green or the brand color. Use them for status chips, charts, validation and destructive actions (chips as a faint fill with the same family's dark text), never as decoration or as the brand accent.
- Never color alone: an error is red plus an icon plus words that say how to fix it ("Enter an amount over $1").
- Dark screens: surfaces get lighter as they rise (page, card, popover) and shadows barely show; lift the accent a step so it still passes contrast.
- Text on any fill passes WCAG AA: 4.5:1 for body, 3:1 for 24px+ or bold 19px+.

## 5. Space and size

- Spacing on the 4px grid, from these steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Other values only where a fixed size needs them (an icon centered in a 44px button).
- Desktop content column: 1248-1280 wide (padding 80-96 on a 1440 frame), every section aligned to it.
- Section padding: 96-128 top and bottom on desktop, 64 on mobile. Heading to its paragraph 16-24, text block to its visual 48-64. Always more space above a heading than below it.
- Vary density down the page: a dense passage earns a quiet one. Not every section is the same title, lead and grid.
- Siblings are identical: same card size, padding, gap and treatment; differences go in a small chip or label.
- Buttons 44-52px tall (padding about 12 x 24), inputs 44-48px, one radius family (e.g. 8 buttons and inputs, 16 cards, 24 big panels).
- Cards: padding 24-32, a hairline border or a soft shadow, never both, radius 12-16. Pills are for small controls and chips. Shadows have a y offset and a soft blur.
- Leave air: a section looks finished when it has room around it, not when every gap is filled.
- Space says what belongs together: the gap inside a group is always smaller than the gap to the next group. A label 8 above its field, helper text 4 below it, 24 to the next field; 12 between a card's title and its text, 24-32 between cards. Equal gaps everywhere means nothing is grouped.
- Nested corners: an inner radius is the outer radius minus the padding between them (a 16-radius card with 8 padding holds 8-radius items), never the same radius inside and out.
- Separate with space or a surface step first (white cards on a faintly tinted page), a single hairline second. Never a border, a fill and a shadow on one box, and no box around every row.
- Cards in a row: same height, the action pinned to the bottom with a flexible spacer, images in one shape and crop, titles of about the same length.
- A shadow on a colored ground takes that ground's hue (a purple-gray shadow on a lilac field), never neutral gray. Shadow depth follows height: cards low, menus and popovers higher, modals highest.
- Focused tasks don't fill the frame: a sign-up, login or checkout sits in a 400-560 column or card with air around it, its inputs as wide as that column.

## 6. Hierarchy, actions, copy and forms

- Before drawing, rank what's on the screen by how much it matters to the person using it, and give the top item the most size, weight and contrast. A value beats its label (a KPI's number is the biggest, darkest text; "Revenue" is small and muted); a product's name and price beat its quantity.
- One primary action per view or card: a filled accent button, also the largest. Secondary actions are neutral (outline, ghost or a muted fill), tertiary are text links. Two filled buttons side by side read as two equal choices.
- Buttons with the same job look the same on every card and screen; don't recolor them to match each card's image.
- Labels say what happens, in sentence case: "Create account", "Pay $65", "Save changes". Never "Submit" or "OK".
- Copy: write the real thing, with the product's own nouns, names and numbers.
  - A headline says what it does and for whom ("Payroll for restaurants with tipped staff"), not how it feels ("Work, reimagined"). One specific claim beats three adjectives.
  - Never: seamless, effortless, unlock, supercharge, elevate, empower, revolutionize, streamline, all-in-one, next-generation, cutting-edge, "X, reimagined", "X made simple", "Say goodbye to …". Replace each with the concrete detail it was hiding.
  - Sentence case for headings, buttons, labels and menu items. No exclamation marks in UI text.
  - Figures for numbers ("3 projects", "$1,240"), and one date and currency format per screen.
  - Empty, error and confirmation messages say what happened and what to do next, in the product's voice, never "Oops!" or "Something went wrong".
- Placement: in a dialog, actions bottom-right, Cancel then the action (red when it destroys something). In a form, actions under the last field, aligned with the fields. An action sits next to the thing it acts on: the quantity stepper beside Add to cart, row actions in the row.
- Forms:
  - A label above every field; a placeholder never stands in for it and is visibly lighter than typed text.
  - Field width follows the expected answer: card number full width, expiry and CVC side by side at half width, ZIP short. A one-time code is one box per digit.
  - Fewer fields: no Confirm password (an eye toggle and an inline strength meter instead). Long forms are grouped under small headings (Personal, Account).
  - Five options or fewer: radio buttons, a segmented control or selectable cards, not a dropdown. Colors as swatches, quantities as a stepper.
  - Validation sits under its field: a red border, an icon and a sentence that says how to fix it. Toasts confirm finished actions; they never carry form errors.
  - An input is a light fill or a hairline box; it never takes the accent fill, so it can't be mistaken for a button.
- Icons: one style per screen (outline, with filled only for the active tab or a selected state), one size per context (16-20 beside 14-16px text, 24 in navigation), the color of the text beside them and 8 from it. Hit area at least 40 on desktop and 44-48 on mobile. Keep universal meanings (magnifier searches, trash deletes); an icon that isn't obvious gets a text label.`;

const LANDING = `## 7. Landing page recipe

A landing page is a whole page, usually 2400-4000px tall in one 1440 frame. What it must do is fixed; its order and form are not. Pick a structure from the product and the story it tells, name it before you draw, and don't reuse the structure of the user's other sites ("This site" lists them).

A landing page has jobs, not a fixed list of sections. Each job takes the form this product's content asks for; the forms named here are examples, not a checklist. The Refuse list (section 2) names each job's category default:
- Navigation (64-80px): logo, a few links, the primary action. It may sit inside the hero's color field rather than on white with a hairline.
- A first viewport that is a thesis, not a header: the offer clear, the primary action visible, a trust line. Its form varies: the product at full scale, a typographic statement, a photo from the customer's world, something to try, the sign-up form itself. Ask: if someone left after this viewport, what would they describe an hour later? If the answer is a mood, it is not decided yet.
- The product, believable: plausible names and numbers, never a small window beside the copy (960+ wide, or full-bleed and cropped). Annotate it, zoom into one detail, or show two states of it. It may lead the page or arrive once the problem is set up.
- Evidence, only when there is something specific to show: a customer's before and after, a real-looking document or export, an integration list, a changelog, a named quote. Keep endorsements clearly fictional demo content. The customer's work (their shop floor, their document) or a drawn avatar says more than a stock portrait.
- The key features, in the form their content asks for: a workflow reads as one continuous sequence drawn across the page; capabilities of one screen read as callouts on a large product view; unlike features read as text and visuals at different sizes. Three same-size cards only when the items really are equivalent and nothing better fits; then make each card show its feature (a fragment of UI) instead of an icon chip.
- An ending that hands the reader their next step: the sign-up form or pricing itself, the product's finished state, a short FAQ that answers the last objection, or the action set into the footer.
- A footer: logo, link columns, legal line.
- Text over a photo sits in the photo's calm area, or on a scrim of the photo's own dark tone, and still passes contrast over its lightest part.
- A sign-up or login page: the form in its own column or card; an image beside it may set the mood but carries no text or button of its own.

Structures (pick one, mix two, or invent one; nav, product hero, logo strip, alternating feature rows, testimonial and CTA band is the one to avoid):
- Artifact first: the product's real artifact (an invoice moving through approval, a schedule filling up) at full scale in the first viewport, the headline set against it, features as callouts on it.
- One story: a single customer followed from the problem to the result, the product appearing where it changes the outcome.
- Before and after: the old way and the new way, the whole page built on the contrast.
- Walkthrough: one workflow drawn down the page as a continuous path, each step a stop on it.
- Editorial: a long read that opens with an argument, the product shown in figures between passages.
- Offer first: pricing or the sign-up form near the top, for a product people already understand; the rest answers objections.
- Live demo: the first viewport is the product in use with something to try; the page below it is short.`;

const APP = `## 7. App screen recipe

1. Shell: a left sidebar (240-280 wide: workspace switcher, search, 6-8 nav items with icons, active item on a faint accent fill) or a top bar.
2. Page header: title (24-30px), one line of description, actions on the right (secondary, then primary).
3. Content on a clear grid: KPI cards in a row, then the main table, board or chart. Tables: 44-52px rows, 13-14px text, a header row in muted small text, status as chips, numbers right-aligned.
4. Realistic data everywhere: names, companies, amounts, dates. Never "Item 1" or lorem ipsum.
5. Each meaningful state (empty, loading, error, filled) is its own frame next to the main one. Empty: what this place is for, one line on why it's empty, the one action that fills it ("Create project"), and a small illustration in the theme's colors; never a bare "No projects". Error: what went wrong in plain words, how to fix it and a way back (retry, home, search), in the app's own style.
6. Show the content, not a door to it: a home or dashboard shows the first items (recent files, recommended recipes) instead of a banner linking to them, and "Continue where you left off" beats making people remember.
7. Task screens (checkout, sign-up, settings) carry nothing unrelated to the task: no promo card beside the form.
8. Menus: items grouped under small headings, each an icon, a title and one line of description.`;

const MOBILE = `## 7. Mobile screen recipe

1. Frame 390 x 844. Side padding 20-24, a status-bar gap at the top (about 47px), a home-indicator gap at the bottom.
2. Type: the mobile scale in section 3. Headings shrink a lot from the desktop version, body hardly at all. Paragraphs 30-40 characters per line.
3. Touch targets at least 44px tall. The primary action, and its alternative (Sign in under Sign up), sit in the bottom third where a thumb reaches; full width and pinned to the bottom with a flexible spacer when the frame height is fixed. The top bar holds back, the title and at most one or two icon actions.
4. One column. Group content in cards or plain sections with 24-32 between them.
5. Navigation: a tab bar (4-5 items, icon plus label) or a top bar with back and title.
6. A table becomes a list of cards showing the two or three fields that matter.`;

const widths = (surface: DesignSurface) =>
  surface === "mobile"
    ? `- Widths: a native app screen is drawn at 390 only. When the screen is a mobile web page, also draw it at 1440: headings about one and a half times larger, body the same, content in a 1248-1280 column.`
    : `- Widths: a web page or web app is coded for every width, so draw its main page at 1440 and at 390 side by side with the same content, and at 768 too when the layout changes there (a sidebar becoming a rail). Name each frame by its route and width, plus its state when it has one ("/pricing · 1440", "/pricing · 390", "/projects · empty · 1440"): build_pages reads the name as the route, and the widths as its breakpoints. Going narrow:
  - Grids of three or four go to one column (two at 768); a text and a visual side by side stack, text first.
  - The sidebar becomes a drawer behind a menu button, or a bottom tab bar for 4-5 top destinations; nav links fold into a menu button; the primary action stays visible.
  - Tables become cards showing the two or three fields that matter.
  - ${surface === "landing" ? "Hero 64-80 goes to 36-44 and section titles 40-48 to 28-32; body stays 16. Section padding 96-128 goes to 64" : "Page titles 24-30 go to 22-26; body goes from 14 to 15-16, and inputs to 16 so phones don't zoom into them. The page header's actions fold into one primary button and a menu"}, side padding to 20-24.
  - Nothing scrolls sideways except a deliberate carousel or a wide table in its own scroller.`;

const forCode = (surface: DesignSurface) => `## 8. Design for code

A screen here is a spec someone will code, so draw what the code needs, not only the resting picture.
${widths(surface)}
- States: code needs every state of an interactive part. Make buttons, inputs, selects, tabs, nav items and table rows project components (define_component) with variants (Button: primary, secondary, ghost, destructive), and draw a "States" frame beside the first screen that shows each part at rest, hover, focus, disabled and selected in a row (inputs also filled and error).
  - Hover: one step darker fill, or a faint $muted fill on ghost buttons, nav items and rows.
  - Disabled: $muted fill and $muted-foreground text (or 50% opacity), no shadow.
  - Selected: a faint accent fill plus an indicator or a heavier weight, never color alone.
- Focus and access: focus is a 2px $ring outline 2px off the element, on every interactive part, never removed. Give an icon-only button a name ("Close dialog", "Search"), which the code uses as its aria-label, and a photo a name saying what it shows, which becomes its alt text. Headings go in order, one $h1 per page, then $h2 and $h3, chosen by structure rather than size. The layout tree's order is the reading and tab order: don't move content into place with overlays.
- Dark mode: when the theme has dark colors and the product has a dark mode, draw the main ${surface === "landing" ? "page" : "screen"} once more with mode: "dark" (named "… · dark"). Surfaces step lighter as they rise, borders do the work shadows did, and the accent and status colors are checked for contrast again.${surface === "landing" ? " Otherwise a landing page is light or dark from its scene (section 1), not both." : ""}
- Charts: a chart answers one question, and its title says the answer ("Refunds doubled in March", not "Refunds"). The chart element (create_elements type chart) draws one series as bar, line, pie or donut; draw anything richer (two series, annotations, labels on the marks) as SVG. Either way:
  - bars compare amounts and start at zero, a line shows change over time, a pie or donut shows parts of one whole and only up to 5 slices;
  - the series or bar that matters in the accent and the rest in neutrals, labeled on the chart rather than in a legend;
  - hairline gridlines in $border, axis text muted at 12, values right-aligned;
  - no 3D, shadows or gradients on the marks.
- Handoff: every color, radius and text style a $token, so the code's theme classes reproduce it; every repeated part an instance of a project component; structure built from stacks, rows and grids, which code as flex and grid, rather than free-placed elements, which code as absolute positions.`;

const BUILD = `## 9. Building it in Prism

- One create_screen per frame. A whole landing page fits in one call (up to 800 nodes).
- Two ways to write it: a layout tree (root), or HTML + Tailwind (html), which the board tab renders and reads back. Use whichever you write better; HTML suits dense marketing pages and anything you'd reach for flex, grid or absolute positioning for. In HTML:
  - Theme classes keep the screen on the theme and come back as $tokens: bg-primary text-primary-foreground, bg-card, bg-muted, text-muted-foreground, border-border, rounded-md/lg/xl, text-display/h1/h2/h3/h4/body-lg/body/body-sm/caption/label, font-heading. A strict theme refuses palette colors (bg-blue-500), arbitrary sizes and padding or gaps off its spacing steps.
  - Icons: <i data-icon="arrow-right" class="size-4 text-primary"></i> (add fill-amber-400 for a solid star). Photos: <img src="…from search_images" class="h-80 w-full rounded-2xl object-cover">. Avatars: <img data-avatar="Maya Okafor" class="size-10 rounded-full">. Logos and illustrations: inline <svg>, colored with fill-*/stroke-* classes.
  - Components: <x-use component="Button" variant="ghost" label="Cancel"></x-use>; children fill the component's slot.
  - data-name="Hero" makes an element and its contents one group; data-role="card" says what it is. absolute elements are layers (a caption card hanging off a photo: relative parent, absolute -bottom-8 -left-10 child).
  - Not drawn: ::before/::after content, video, canvas.
  - Example: <form data-name="Sign up" data-role="form" class="flex w-[560px] items-center gap-2 rounded-lg border border-border bg-card p-2"><span class="flex-1 px-3 text-body text-muted-foreground">you@company.com</span><a data-role="button" class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-label text-primary-foreground">Start free <i data-icon="arrow-right" class="size-4"></i></a></form>
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

## 10. Check it

1. Fix the warnings create_screen returns (text that wraps more than written, content spilling out of its container or frame, low contrast, tiny text, too many sizes or accent colors, side-by-side cards of different heights, blocks just off the main column, a rating of outline-only stars, gray boxes standing in for images, pure black or white ink, light weights on small text, line heights out of range, a radius as round as its container's, two filled accent buttons side by side, a label as far from its field as from what's above it, gray shadows on a colored ground) with update_elements or by redrawing the section. Ignore one only when it is intended; status chips and charts may use their own colors.
2. export_image the frame and go through it in this order:
   1. Composition: one focal point per section; everything on the content column; equal sibling spacing; readable contrast; nothing cramped or orphaned.
   2. Hierarchy: name the five things on the screen in order of importance and confirm the export reads in that order, even in grayscale.
   3. Actions: count the filled accent buttons in each view. More than one is a hierarchy bug unless it's the same action repeated down a list.
   4. Refuse: go through section 2 and remove what the brief didn't ask for.
   5. Name swap: put an unrelated product's name on it. If the page still fits, its composition, copy or signature move is too generic, and so is a design someone could guess from the category alone.
   6. Other sites: it must not pass for another of the user's sites (or, on a site with screens, for a page from a different site). Compare how it opens, proves and ends with the patterns "This site" lists.
   7. Handoff (section 8): the other widths are drawn, interactive parts have their states, icon-only buttons and photos have names, the copy has none of the banned words, and nothing reusable is drawn twice instead of used as a component.
   Fix everything in one batch and look once more; two rounds is the ceiling.
3. When the screen follows a reference image on the board, run compare_reference (frameId, referenceId) and fix the differences that matter: layout and tone usually, not the reference's brand colors. Compare again after fixing.
4. Tell the user the thesis, the direction and structure you chose and what you took from each reference.`;

const DECIDE: Record<DesignSurface, () => string> = {
  landing: DECIDE_LANDING,
  app: DECIDE_PRODUCT,
  mobile: DECIDE_PRODUCT,
};
const RECIPES: Record<DesignSurface, string> = { landing: LANDING, app: APP, mobile: MOBILE };

/** The guide for a surface, ending with the board's "This site" section (site-context.ts) if given. */
export function designGuide(surface: DesignSurface, site?: string) {
  return [
    HEADER,
    DECIDE[surface](),
    REFUSE,
    system(surface),
    RECIPES[surface],
    forCode(surface),
    BUILD,
    site,
  ]
    .filter(Boolean)
    .join("\n\n");
}

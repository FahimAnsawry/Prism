// The design guide get_design_guide returns: how a screen should look before it is drawn. Tool
// descriptions say how to call Prism; this says what good looks like, so an AI editor doesn't
// fall back on small, dense, many-colored defaults.

export const DESIGN_SURFACES = ["landing", "app", "mobile"] as const;
export type DesignSurface = (typeof DESIGN_SURFACES)[number];

const BEFORE = `# Prism design guide

Read this before the first screen. It sets the quality bar; the project theme (get_theme) and the user's requests come first wherever they differ.

## 1. Decide before you draw

Answer these in two or three lines each, then design from the answers:
- Thesis: one sentence on what this screen must make the viewer feel and do (e.g. "calm, product-led: the real pipeline UI sells it, one obvious Start free").
- Signature move: the one visual idea someone would remember (a giant headline, a floating product window, a signup card in the hero, a dark CTA band).
- From each reference: the structure, hierarchy and density you are taking, never its brand, logo or copy. Mixing two references in one design is good.
- Palette: neutrals, one accent family, meaning colors only for status.
- Type: one family (or one display face plus one text face) and the sizes below.`;

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
| Caption, eyebrow | 12-13 | 500-600 | 1.3 | 0.06 uppercase |

- Never below 12px. Product mocks inside a page may use 13-14px for table text; that is the floor.
- At most 3 sizes per section, and the same role always gets the same size.
- Headlines: 2 lines at most, about 8 words, broken by hand with \\n where the phrase breaks. Paragraphs: 520-640px wide (60-75 characters per line).
- With a strict theme, use its text styles ($display, $h1-$h4, $body-lg, $body, $body-sm, $caption, $label) instead of sizes.
- Fonts: inter, sans (DM Sans), poppins, montserrat, lato, playfair, merriweather, or any Google Font as gf:<Name> (gf:Inter Tight, gf:Plus Jakarta Sans, gf:Instrument Serif, gf:Geist). A serif display face over a sans body is a strong, simple signature.

## 3. Color

- Neutrals carry the page: near-black ink for headings (#0f172a, #111827), a muted gray for body (#475569, #6b7280), white and one faint gray surface (#f8fafc, #f9fafb), hairline borders (#e5e7eb).
- One accent family: its solid shade for the primary button and key highlights, its faint tint (50/100) for large tinted surfaces such as a hero band or a badge. Never two loud accents on one page.
- Meaning colors (green success, red error, amber warning, blue info) only on status chips and charts, as a faint fill with the same family's dark text.
- One dark section per page at most (the final CTA band or the footer).
- Text on any fill passes WCAG AA: 4.5:1 for body, 3:1 for 24px+ or bold 19px+.

## 4. Space and size

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Nothing in between.
- Desktop content column: 1200-1280 wide (padding 80-120 on a 1440 frame), every section aligned to it.
- Section padding: 96-128 top and bottom on desktop, 64 on mobile. Heading to its paragraph 16-24, text block to its visual 48-64.
- Siblings are identical: same card size, padding, gap and treatment; differences go in a small chip or label.
- Buttons 44-52px tall (padding about 14 x 24), inputs 44-48px, one radius family (e.g. 8 buttons and inputs, 16 cards, 24 big panels).
- Cards: padding 24-32, either a hairline border or a soft shadow, not both heavy. Feature icon chips 40-48px squares with a 20-24px icon.
- Leave air: a section looks finished when it has room around it, not when every gap is filled.`;

const LANDING = `## 5. Landing page recipe

A landing page is a whole page, usually 2400-4000px tall in one 1440 frame. Minimum: nav, hero, social proof, features, final CTA, footer.

1. Nav (64-80px): logo, 4-5 links, a quiet secondary action (Sign in) and the primary CTA. A hairline below.
2. Hero, one of:
   - Centered: eyebrow pill, 2-line headline, 1-2 line lead, primary + secondary button, a trust line (No credit card required), then a large product window below.
   - Split: copy left (about 560 wide), product visual right.
   - Split with signup: headline left, a signup card right (fields, primary button, social sign-in, fine print).
3. Product visual: the hero's image is the product. Draw a believable app window (window bar, sidebar, a real table, kanban or chart with plausible names and numbers), 960-1200 wide, optionally on a faint tinted panel behind it for depth.
4. Social proof: a one-line claim (Trusted by 4,000+ revenue teams) and 5-6 gray wordmark logos, or a stats row.
5. Features: a section title and lead, then 3 (or 6) identical cards: icon chip, 20-24px title, two lines of body.
6. Optional: alternating text and visual rows for 2-3 key features, a testimonial with name and role, a pricing teaser.
7. Final CTA band: one headline, one line, one button. The page's single dark or accent-filled block.
8. Footer: logo, 3-4 link columns, legal line.`;

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
- Stack children stretch to the full width by default. Put badges, pills, icon chips and buttons in a row (or set align: "start" on the stack) so they hug their content.
- Give big headlines room: put \\n where the line should break and make sure the container is wide enough, or it wraps into extra lines.
- Layering (a card floating over a product window, a badge on an avatar, glass over a photo): an overlay container. Its first child is the base and sets its size; later children draw on top, each placed by anchor (top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right) and x/y in px, negative to hang past an edge. A product window with a stat card floating off its bottom-left: { type: "overlay", children: [ { type: "stack", name: "Product window", … }, { type: "stack", name: "Stat card", anchor: "bottom-left", x: -32, y: 32, width: 240, padding: 20, fill: "#ffffff", radius: 16, shadow: "lg", children: [ … ] } ] }.
- Charts: create_elements type chart. A standalone picture: add_image.
- Paint, on containers and boxes (and rect/frame elements):
  - image: { url, fit: "cover" } puts a photo inside the shape, clipped to its radius: hero photos, card covers, avatars (a box with shape "ellipse"). Prism downloads it.
  - radius per corner: [16, 16, 0, 0] for a cover photo on top of a card.
  - gradient: { type: "linear", angle: 135, stops: [{ color: "$primary", position: 0 }, { color: "#a855f7", position: 100 }] } for hero bands and CTA blocks; keep it to one accent family.
  - shadow as soft layers instead of a preset, like CSS box-shadow: [{ x: 0, y: 24, blur: 48, spread: -12, color: "#0f172a26" }].
  - backdropBlur: 16 with a semi-transparent fill (#ffffffb3) and a hairline stroke for frosted glass over a photo or gradient.
- Name every component (one groupId) and give it a role, so build_pages can code it.

## 7. Check it

1. create_screen returns warnings (text that wraps more than written, content spilling out of its container or frame, low contrast, tiny text, too many sizes or accent colors). Fix each with update_elements or redraw the section; ignore one only when it is intended.
2. export_image the frame and critique it against your thesis and the references: one focal point per section, everything on the content column, equal sibling spacing, readable contrast, nothing cramped, nothing orphaned. Fix and look again.
3. Tell the user the thesis and what you took from each reference.`;

const RECIPES: Record<DesignSurface, string> = { landing: LANDING, app: APP, mobile: MOBILE };

export function designGuide(surface: DesignSurface) {
  return [BEFORE, SYSTEM, RECIPES[surface], BUILD].join("\n\n");
}

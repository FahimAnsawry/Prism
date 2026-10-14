# Design guide updates from two UI books

Proposed changes to the guide `get_design_guide` serves (`apps/server/src/mcp/design-guide.ts`), taken from:

- **Enhance UI: Design for Developers** (Twarog & Moller, 1.02 dark, 437 pp). Cited as **EUI p.N**.
- **The UI/UX Playbook** (uxpeak, 143 pp). Cited as **PB p.N**.

I read every page of both and compared each rule against the current guide. The guide's job is to stop AI editors from drawing the category default, and both books are general best-practice primers. So most of their advice is either already in the guide, or is exactly the generic default the guide tells editors to avoid. What's left is mostly about **hierarchy between actions, forms, states, icons and a handful of exact numbers**. The guide barely covers these today, and they matter most on app and mobile screens and on sign-up flows.

> `prism-design-guide.md` at the repo root is an older copy of the guide. It is missing the "post a short brief" paragraph, the overused-font list, "Leave air" and most of §6. Make the edits in `design-guide.ts`, then regenerate or delete the `.md`.

---

## Where the new text goes

`designGuide(surface)` returns `BEFORE + SYSTEM + one recipe + BUILD`, so an editor drawing a landing page never sees `APP` or `MOBILE`. That's why:

- Rules that apply on every surface (actions, forms, icons, proximity) go in **`SYSTEM`**. Landing pages have sign-up forms and buttons too.
- Only the app-specific and mobile-specific parts go in `APP` and `MOBILE`.
- I propose one new `SYSTEM` section, **"5. Hierarchy, actions and forms"**. The recipes then become §6, Build §7 and Check §8. The only cross-reference to update is "Color strategy (section 3)" in `BEFORE`, which doesn't change.
- Budget: the proposed text adds about 4–5 KB. Each bullet is written in the guide's own voice (short sentences, `44-52` ranges, no em dashes), ready to paste.

---

## 1. Already covered (no change)

| Book rule | Source | Guide today |
| --- | --- | --- |
| Spacing on a 4-based scale, no odd values like 19 or 31 | PB p.27–28, EUI p.82–83 | §4 spacing scale, "Nothing in between" |
| Body text 16px, nothing below 12px | PB p.89, EUI p.64 | §2 table, "Never below 12px" |
| Contrast 4.5:1 for body text | PB p.20, 92; EUI p.43, 271 | §3 WCAG AA line |
| One font, or two at most | PB p.74–75, EUI p.306, 380 | §1 Type, §2 Fonts |
| 45–75 characters per line on desktop | PB p.75–79 | §2 paragraphs 520-640px |
| Tighter line height for headings, looser for body | PB p.90–91, EUI p.62–63 | §2 table (1.05 hero … 1.5 body) |
| Negative letter spacing on large type | EUI p.60–61 | §2 letter spacing |
| Start with too much whitespace, then reduce | PB p.25–26, EUI p.81 | §4 "Leave air" |
| Soft shadows with a y offset; no harsh shadows | PB p.51, EUI p.90–91 | §4 cards, Refuse list (hard offset shadows) |
| Shadow **or** border, not both | EUI p.91 | §4 cards "never both" |
| Siblings share size, radius and treatment | PB p.37–43 | §4 siblings, `uneven-siblings` lint |
| Status colors only for their meaning | PB p.70, EUI p.94, 150 | §3 meaning colors |
| Glass only where text sits on a busy image | PB p.62–64 | §6 backdropBlur rule |
| No lorem ipsum, realistic data | EUI p.65 | §5 App 4 |
| Right-aligned numbers, muted table header | EUI p.168, 173 | §5 App 3 |
| Empty, loading and error states as frames | PB p.135–139 | §5 App 5 (structure only; see 2.5 for content) |

---

## 2. Additions

### 2.1 §2 Type: weight, line-height bounds, long text, caps

**Why:** the table gives target values but no bounds, and it says nothing about weight below the hero, chunking or centered text. Both books show these as the most common failures (PB p.80–83, 86, 93–96; EUI p.52, 58, 63, 68, 145).

Add to the `## 2. Type` bullets:

```text
- Weight: headings 600-700 over 400 body. Nothing under 400 below 20px; light weights only at display sizes. Bold inside a paragraph marks one or two things, not every term.
- Line height falls as size rises: body 1.5-1.6, about 1.3 at 32-40px, 1.05-1.15 at display sizes. Body never above 1.75, headings never above 1.3.
- Long text: break anything over four or five lines into short paragraphs, or a list under small subheadings. Left-align it; center only a headline, one or two lines under it and a button.
- All caps only for short labels (captions, table headers), never on buttons, badges or a sentence.
```

### 2.2 §3 Color: pure black/white, what the accent means, color not alone, dark grounds

**Why:**

- The guide says "near-black ink" but never forbids `#000`/`#fff`. Both books call pure black on white and pure white on black harsh (PB p.82, 95; EUI p.264).
- An accent used everywhere stops meaning "clickable" (PB p.65–66).
- Color alone fails for color-blind users (PB p.69).
- Destructive actions must stay red (PB p.119–121, EUI p.258–259).

Replace the Neutrals bullet and add three bullets after "Never two loud accents":

```text
- Neutrals: near-black ink for headings (never pure #000000 on white), body text a step lighter, one or two surfaces, hairline borders. On dark grounds, headings off-white and body a step dimmer, never pure #ffffff for both. Tint them toward the main hue when that hue owns the page; on a colored field, derive secondary text from that hue rather than a generic gray.
- The accent marks what can be clicked or is selected: the primary action, links, the active item. Spread over headings, icons and backgrounds, it stops meaning anything.
- Never color alone: an error is red plus an icon plus words that say how to fix it ("Enter an amount over $1").
- Meaning colors keep their meaning, tuned to the palette but never swapped: a Delete button is red, never green or the brand color.
- Dark screens: surfaces get lighter as they rise (page, card, popover) and shadows barely show; lift the accent a step so it still passes contrast.
```

### 2.3 §4 Space and size: proximity, nested radius, separation, card rows, shadow tint, focused tasks

**Why:**

- Proximity is the biggest gap. The guide has spacing values but no rule that says what belongs together. PB p.12: a label 28px from both its field and the field above it is ambiguous; 12px below / 32px above fixes it. EUI p.107, 281–289 makes the same point.
- Same radius inside and out (EUI p.192).
- Too many borders (PB p.58–60, EUI p.88).
- CTAs not pinned in uneven cards (PB p.43).
- Gray shadows on colored grounds (PB p.52–53).
- Forms stretched to 1440 (PB p.129–130).

Add to `## 4. Space and size`:

```text
- Space says what belongs together: the gap inside a group is always smaller than the gap to the next group. A label 8 above its field, helper text 4 below it, 24 to the next field; 12 between a card's title and its text, 24-32 between cards. Equal gaps everywhere means nothing is grouped.
- Nested corners: an inner radius is the outer radius minus the padding between them (a 16-radius card with 8 padding holds 8-radius items), never the same radius inside and out.
- Separate with space or a surface step first (white cards on a faintly tinted page), a single hairline second. Never a border, a fill and a shadow on one box, and no box around every row.
- Cards in a row: same height, the action pinned to the bottom with a flexible spacer, images in one shape and crop, titles of about the same length.
- A shadow on a colored ground takes that ground's hue (a purple-gray shadow on a lilac field), never neutral gray. Shadow depth follows height: cards low, menus and popovers higher, modals highest.
- Focused tasks don't fill the frame: a sign-up, login or checkout sits in a 400-560 column or card with air around it, its inputs as wide as that column.
```

### 2.4 New §5 in SYSTEM: Hierarchy, actions and forms

**Why:** neither the guide nor the screen linter covers action hierarchy or form construction, and these are the core of every app screen and of the sign-up flows Prism is used for.

- One primary action per view (EUI p.87, 256–257; PB p.6–7).
- Primary distinct by size as well as color (EUI p.240–243, 246–247).
- Same job, same button on every card (PB p.39–40).
- Labels that say what happens, not "Submit" (EUI p.145).
- Button placement in dialogs and forms (PB p.120–121, EUI p.145–146).
- Fitts's law (PB p.99, 106–107).
- Form construction (PB p.12, 113–118; EUI p.103–105, 111, 117, 139, 156).
- Icons (PB p.44–45; EUI p.92, 209–216, 310–311).

Insert as a new section after `## 4`:

```text
## 5. Hierarchy, actions and forms

- Before drawing, rank what's on the screen by how much it matters to the person using it, and give the top item the most size, weight and contrast. A value beats its label (a KPI's number is the biggest, darkest text; "Revenue" is small and muted); a product's name and price beat its quantity.
- One primary action per view or card: a filled accent button, also the largest. Secondary actions are neutral (outline, ghost or a muted fill), tertiary are text links. Two filled buttons side by side read as two equal choices.
- Buttons with the same job look the same on every card and screen; don't recolor them to match each card's image.
- Labels say what happens, in sentence case: "Create account", "Pay $65", "Save changes". Never "Submit" or "OK".
- Placement: in a dialog, actions bottom-right, Cancel then the action (red when it destroys something). In a form, actions under the last field, aligned with the fields. An action sits next to the thing it acts on: the quantity stepper beside Add to cart, row actions in the row.
- Forms:
  - A label above every field; a placeholder never stands in for it and is visibly lighter than typed text.
  - Field width follows the expected answer: card number full width, expiry and CVC side by side at half width, ZIP short. A one-time code is one box per digit.
  - Fewer fields: no Confirm password (an eye toggle and an inline strength meter instead). Long forms are grouped under small headings (Personal, Account).
  - Five options or fewer: radio buttons, a segmented control or selectable cards, not a dropdown. Colors as swatches, quantities as a stepper.
  - Validation sits under its field: a red border, an icon and a sentence that says how to fix it. Toasts confirm finished actions; they never carry form errors.
  - An input is a light fill or a hairline box; it never takes the accent fill, so it can't be mistaken for a button.
- Icons: one style per screen (outline, with filled only for the active tab or a selected state), one size per context (16-20 beside 14-16px text, 24 in navigation), the color of the text beside them and 8 from it. Hit area at least 40 on desktop and 44-48 on mobile. Keep universal meanings (magnifier searches, trash deletes); an icon that isn't obvious gets a text label.
```

### 2.5 §5 App recipe: states with content, show the content, task screens, menus

**Why:**

- The guide names the states but not what goes in them. PB p.135–139 and EUI p.156 give the content.
- "Exposing content directly" over banners that link to it (PB p.110–112).
- Recognition over recall (PB p.103).
- No distractions on task screens (PB p.102, 127).
- Grouped menus with icons and descriptions (PB p.140–141).

Replace item 5 and add items 6–8:

```text
5. Each meaningful state (empty, loading, error, filled) is its own frame next to the main one. Empty: what this place is for, one line on why it's empty, the one action that fills it ("Create project"), and a small illustration in the theme's colors; never a bare "No projects". Error: what went wrong in plain words, how to fix it and a way back (retry, home, search), in the app's own style.
6. Show the content, not a door to it: a home or dashboard shows the first items (recent files, recommended recipes) instead of a banner linking to them, and "Continue where you left off" beats making people remember.
7. Task screens (checkout, sign-up, settings) carry nothing unrelated to the task: no promo card beside the form.
8. Menus: items grouped under small headings, each an icon, a title and one line of description.
```

### 2.6 §5 Mobile recipe: thumb zone, line length, type scaling, tables

**Why:**

- The thumb zone puts both the CTA and Sign in in the bottom third (PB p.133–135).
- Lines of 30–40 characters on mobile (PB p.76).
- Headings shrink by up to half from desktop, body by about 10% (EUI p.66–67).
- Tables collapse to cards (EUI p.171).

Replace items 2 and 3 and add item 6:

```text
2. Type: headline 28-34, body 16, small 14; nothing under 12. Headings shrink a lot from the desktop version, body hardly at all. Paragraphs 30-40 characters per line.
3. Touch targets at least 44px tall. The primary action, and its alternative (Sign in under Sign up), sit in the bottom third where a thumb reaches; full width and pinned to the bottom with a flexible spacer when the frame height is fixed. Only back and the title live in the top corners.
6. A table becomes a list of cards showing the two or three fields that matter.
```

### 2.7 §5 Landing recipe: text on photos, sign-up page

**Why:**

- Text over images has to survive the lightest part of the image (PB p.21, EUI p.340–341).
- On a sign-up page, the brand image beside the form must carry no CTA of its own (PB p.127–128).

Add to the jobs list:

```text
- Text over a photo sits in the photo's calm area, or on a scrim of the photo's own dark tone, and still passes contrast over its lightest part.
- A sign-up or login page: the form in its own column or card; an image beside it may set the mood but carries no text or button of its own.
```

### 2.8 §7 Check it: hierarchy and primary-count checks

**Why:**

- The grayscale and squint test (EUI p.42).
- Ranking content before you design (PB p.9).
- One primary per view (from 2.4).

Add to step 2, before the slop check:

```text
Then the hierarchy check: name the five things on the screen in order of importance and confirm the export reads in that order, even in grayscale. Count the filled accent buttons in each view: more than one is a hierarchy bug unless it's the same action repeated down a list.
```

---

## 3. Book advice to leave out

Three pieces of book advice stay out of the guide. Recording them so nobody "fixes" the guide back toward them. The first two are fine advice in general, but they produce the generic page the guide exists to prevent. The third doesn't fit how Prism boards are used.

| Book advice | Source | Why it stays out |
| --- | --- | --- |
| Font shortlists: Inter, Roboto, Open Sans, Lato, Manrope, Gotham; pairs Montserrat + Open Sans, Raleway + Merriweather, Playfair + Roboto | PB p.74–75, 96; EUI p.48 | **Against the guide's purpose.** §2 names these as the faces every AI-made page uses. They're fine as an app shell's workhorse sans, and wrong as a landing page's voice. |
| Category to typeface or color (serif for law, script for beauty, blue = trust, black = luxury, green = calm) | PB p.71–72; EUI p.38–39, 261 | **Against the guide's purpose.** This is the "category default" §1 asks editors to name and avoid. Directions come from the product's materials, not from a psychology chart. |
| Lorem ipsum and gray boxes in wireframes | EUI p.352 | **Prism-specific.** Prism boards get coded into pages (`build_pages`), so placeholder copy leaks into code. The guide's "realistic data everywhere" and the `missing-imagery` lint stay. |

---

## 4. Optional linter follow-ups (`apps/server/src/mcp/screen-lint.ts`)

The linter already checks overflow, wrap, orphans, outline-only ratings, off-column blocks, palette size, row fill, type scale, uneven siblings, missing imagery, contrast and tiny text. These rules from section 2 can be checked the same way, from element props alone:

| Proposed kind | Trigger | Rule it backs |
| --- | --- | --- |
| `pure-ink` | text `#000000` on a light fill, or `#ffffff` body text on a dark fill | 2.2 |
| `light-weight` | `fontWeight < 400` and `fontSizePx < 20` | 2.1 |
| `line-height` | body (≤ 20px) `lineHeight` above 1.75 or below 1.3; text ≥ 32px above 1.3 | 2.1 |
| `nested-radius` | a child's radius ≥ its container's radius while the child is inset from the edge | 2.3 |
| `primary-count` | two or more accent-filled `role: "button"` elements in one row or group | 2.4, 2.8 |
| `proximity` | in a stack, a label's gap to its input ≥ the gap above the label | 2.3 |
| `gray-shadow` | a neutral shadow color on a saturated fill | 2.3 |

`pure-ink`, `light-weight` and `line-height` are the cheapest: they read one element each. `proximity` and `nested-radius` need the container lookups that `containerOf` already does.

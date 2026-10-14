/** Shapes shared by the logo (prism-logo.tsx), the hero's prism and the landing page's prism flight. */

/**
 * The prism's facets with rounded corners (each is its sharp facet grown by 2 with round joins,
 * drawn as a fill so color classes work), in a 36-unit box. The order is the one every animation
 * builds them in: top, left, right, then the green center (which points down).
 */
export const CORNER_FACETS = [
  "M19.79 3.58L24.41 12.83A2 2 0 0 1 22.62 15.72L13.38 15.72A2 2 0 0 1 11.59 12.83L16.21 3.58A2 2 0 0 1 19.79 3.58Z",
  "M9.65 23.86L14.27 33.11A2 2 0 0 1 12.48 36L3.24 36A2 2 0 0 1 1.45 33.11L6.07 23.86A2 2 0 0 1 9.65 23.86Z",
  "M29.93 23.86L34.55 33.11A2 2 0 0 1 32.76 36L23.52 36A2 2 0 0 1 21.73 33.11L26.35 23.86A2 2 0 0 1 29.93 23.86Z",
];
export const CENTER_FACET =
  "M13.38 18.54L22.62 18.54A2 2 0 0 1 24.41 21.43L19.79 30.68A2 2 0 0 1 16.21 30.68L11.59 21.43A2 2 0 0 1 13.38 18.54Z";

/**
 * The wordmark's i dot, in the logo's svg units: a small prism (14 wide, 17 with its stroke)
 * whose center is (162, 14). Drawn with strokeWidth 3 and round joins.
 */
export const DOT = "M162 6 169 18H155Z";

/**
 * The dot's wings, rooted on its sides and drawn behind it. Each turns around its root (`origin`,
 * in the logo's svg units) and beats between the angles `up` and `down`; `scale` is the size the
 * wings are drawn at. (Motion takes the origin as `originX`/`originY`: it ignores a plain
 * `transformOrigin` style on svg elements.)
 */
export const WING_SCALE = 1.4;
export const WINGS = [
  {
    d: "M158 12C152 4 143 4 139 8C144 9 148 12 158 15Z",
    originX: "158px",
    originY: "13px",
    up: 28,
    down: -18,
  },
  {
    d: "M166 12C172 4 181 4 185 8C180 9 176 12 166 15Z",
    originX: "166px",
    originY: "13px",
    up: -28,
    down: 18,
  },
];

/**
 * Light mode only: the dot and wings keep their brand-green fill but get an ink hairline (the
 * green alone is ~1.3:1 on the canvas). The dot's outline is drawn under it, 2.2 units wider than
 * the dot's own 3-unit stroke (about 1px on the logo); the wings' stroke is centered on their edge.
 */
export const DOT_OUTLINE_WIDTH = 5.2;
export const OUTLINE_CLASS = "fill-ink stroke-ink dark:fill-transparent dark:stroke-transparent";
export const WING_HAIRLINE =
  "stroke-ink dark:stroke-transparent [stroke-width:1.6] [stroke-linejoin:round]";

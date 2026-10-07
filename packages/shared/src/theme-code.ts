import {
  fontFamilyName,
  RADIUS_SCALE,
  TEXT_STYLES,
  type TextStyleName,
  type Theme,
  THEME_COLORS,
  THEME_FONTS,
  themeColorHex,
  type ThemeColor,
  themeToCss,
} from "./theme.js";

// A project's theme in the formats apps are written in (get_theme format): Tailwind v4 +
// shadcn/ui CSS (themeToCss), plain CSS custom properties, JSON design tokens and a Flutter
// theme. Every format keeps the token names, so `$primary` on the board is `bg-primary`,
// `var(--primary)` or `PrismTokens.of(context).primary` in the code.

export const THEME_FORMATS = ["css", "css-vars", "json", "dart"] as const;
export type ThemeFormat = (typeof THEME_FORMATS)[number];

const rem = (px: number) => `${Math.round((px / 16) * 1000) / 1000}rem`;
const radiusPx = (theme: Theme, scale: number) => Math.round(theme.radius * scale * 10) / 10;

/** The text style classes: `text-h1` sets the font, size, weight, line height and spacing. */
const styleClass = (name: TextStyleName) => `text-${name}`;

/** Plain CSS: the theme's custom properties, the type scale as classes and base styles. */
export function themeToCssVars(theme: Theme) {
  const colors = (mode: "light" | "dark") =>
    THEME_COLORS.map((name) => `  --${name}: ${theme[mode][name]};`);
  return [
    `/* Prism theme${theme.name ? `: ${theme.name}` : ""}. Plain CSS custom properties. */`,
    `:root {`,
    `  --radius: ${rem(theme.radius)};`,
    ...Object.entries(RADIUS_SCALE).map(([name, scale]) =>
      scale === 1 ? `  --${name}: var(--radius);` : `  --${name}: calc(var(--radius) * ${scale});`,
    ),
    `  --radius-full: 9999px;`,
    `  --spacing: ${rem(theme.spacing)};`,
    ...THEME_FONTS.map(
      (slot) =>
        `  --font-${slot}: "${fontFamilyName(theme.fonts[slot])}", ${slot === "mono" ? "ui-monospace, monospace" : "system-ui, sans-serif"};`,
    ),
    ...TEXT_STYLES.flatMap((name) => {
      const s = theme.text[name];
      return [
        `  --text-${name}: ${rem(s.size)};`,
        `  --text-${name}--line-height: ${s.lineHeight};`,
        `  --text-${name}--letter-spacing: ${s.letterSpacing}em;`,
        `  --text-${name}--font-weight: ${s.weight};`,
      ];
    }),
    ...colors("light"),
    `}`,
    ``,
    `.dark {`,
    ...colors("dark"),
    `}`,
    ``,
    `body {`,
    `  background: var(--background);`,
    `  color: var(--foreground);`,
    `  font-family: var(--font-sans);`,
    `}`,
    ``,
    `/* The type scale: one class per text style ($h1 → .text-h1). */`,
    ...TEXT_STYLES.flatMap((name) => {
      const s = theme.text[name];
      return [
        `.${styleClass(name)} {`,
        `  font-family: var(--font-${s.font});`,
        `  font-size: var(--text-${name});`,
        `  font-weight: var(--text-${name}--font-weight);`,
        `  line-height: var(--text-${name}--line-height);`,
        `  letter-spacing: var(--text-${name}--letter-spacing);`,
        `}`,
      ];
    }),
    ``,
  ].join("\n");
}

/** The theme as JSON design tokens: colors as hex per mode, radius and spacing in px. */
export function themeToTokens(theme: Theme) {
  const colors = (mode: "light" | "dark") =>
    Object.fromEntries(THEME_COLORS.map((name) => [name, themeColorHex(theme, mode, name)]));
  return {
    name: theme.name ?? null,
    colors: { light: colors("light"), dark: colors("dark") },
    radius: {
      ...Object.fromEntries(
        Object.entries(RADIUS_SCALE).map(([name, scale]) => [
          name.replace("radius-", ""),
          radiusPx(theme, scale),
        ]),
      ),
      full: 9999,
    },
    spacing: theme.spacing,
    fonts: Object.fromEntries(THEME_FONTS.map((slot) => [slot, fontFamilyName(theme.fonts[slot])])),
    textStyles: Object.fromEntries(
      TEXT_STYLES.map((name) => {
        const s = theme.text[name];
        return [name, { ...s, fontFamily: fontFamilyName(theme.fonts[s.font]) }];
      }),
    ),
  };
}

/** "card-foreground" → "cardForeground", "chart-1" → "chart1", "body-lg" → "bodyLg". */
const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** "#rrggbb" or "#rrggbbaa" → Color(0xAARRGGBB). */
function dartColor(hex: string) {
  const rgb = hex.slice(1, 7).toUpperCase();
  const alpha = hex.length === 9 ? hex.slice(7, 9).toUpperCase() : "FF";
  return `Color(0x${alpha}${rgb})`;
}

const dartNumber = (n: number) => (Number.isInteger(n) ? `${n}` : `${Math.round(n * 1000) / 1000}`);

/** Material TextTheme slots for the type scale. */
const TEXT_THEME: Record<TextStyleName, string> = {
  display: "displayLarge",
  h1: "headlineLarge",
  h2: "headlineMedium",
  h3: "headlineSmall",
  h4: "titleLarge",
  "body-lg": "bodyLarge",
  body: "bodyMedium",
  "body-sm": "bodySmall",
  caption: "labelSmall",
  label: "labelLarge",
};

/**
 * The theme as a Flutter file: the color tokens as a ThemeExtension, a ColorScheme mapped from
 * them, the type scale (google_fonts), radius and spacing, and prismTheme() for MaterialApp.
 */
export function themeToDart(theme: Theme) {
  const fields = THEME_COLORS.map(camel);
  const palette = (mode: "light" | "dark") =>
    THEME_COLORS.map(
      (name, i) =>
        `    ${fields[i]}: ${dartColor(themeColorHex(theme, mode, name as ThemeColor))},`,
    );
  const textStyle = (name: TextStyleName) => {
    const s = theme.text[name];
    const family = fontFamilyName(theme.fonts[s.font]);
    return [
      `  static TextStyle get ${camel(name)} => GoogleFonts.getFont(`,
      `        '${family.replace(/'/g, "\\'")}',`,
      `        fontSize: ${dartNumber(s.size)},`,
      `        fontWeight: FontWeight.w${s.weight},`,
      `        height: ${dartNumber(s.lineHeight)},`,
      `        letterSpacing: ${dartNumber(s.letterSpacing * s.size)},`,
      `      );`,
    ].join("\n");
  };
  return [
    `// Prism theme${theme.name ? `: ${theme.name}` : ""}, for Flutter (get_theme format "dart").`,
    `// Save as lib/theme/prism_theme.dart, add google_fonts to pubspec.yaml, then use`,
    `//   MaterialApp(theme: prismTheme(Brightness.light), darkTheme: prismTheme(Brightness.dark))`,
    `// and the tokens in widgets: PrismTokens.of(context).mutedForeground, PrismText.h1,`,
    `// BorderRadius.circular(PrismRadius.lg), EdgeInsets.all(PrismSpacing.of(4)).`,
    ``,
    `import 'package:flutter/material.dart';`,
    `import 'package:google_fonts/google_fonts.dart';`,
    ``,
    `/// The theme's color tokens, with shadcn/ui's names in camelCase ($muted-foreground → mutedForeground).`,
    `@immutable`,
    `class PrismTokens extends ThemeExtension<PrismTokens> {`,
    `  const PrismTokens({`,
    ...fields.map((f) => `    required this.${f},`),
    `  });`,
    ``,
    ...fields.map((f) => `  final Color ${f};`),
    ``,
    `  static const light = PrismTokens(`,
    ...palette("light"),
    `  );`,
    ``,
    `  static const dark = PrismTokens(`,
    ...palette("dark"),
    `  );`,
    ``,
    `  static PrismTokens of(BuildContext context) =>`,
    `      Theme.of(context).extension<PrismTokens>() ?? light;`,
    ``,
    `  @override`,
    `  PrismTokens copyWith({`,
    ...fields.map((f) => `    Color? ${f},`),
    `  }) =>`,
    `      PrismTokens(`,
    ...fields.map((f) => `        ${f}: ${f} ?? this.${f},`),
    `      );`,
    ``,
    `  @override`,
    `  PrismTokens lerp(ThemeExtension<PrismTokens>? other, double t) {`,
    `    if (other is! PrismTokens) return this;`,
    `    return PrismTokens(`,
    ...fields.map((f) => `      ${f}: Color.lerp(${f}, other.${f}, t)!,`),
    `    );`,
    `  }`,
    `}`,
    ``,
    `/// Corner radius in logical px ($radius-lg → PrismRadius.lg).`,
    `abstract final class PrismRadius {`,
    ...Object.entries(RADIUS_SCALE).map(([name, scale]) => {
      // rounded-2xl → PrismRadius.xl2 (a Dart name can't start with a digit).
      const size = name.replace("radius-", "");
      const field = /^\d/.test(size) ? `xl${size[0]}` : size;
      return `  static const double ${field} = ${dartNumber(radiusPx(theme, scale))};`;
    }),
    `  static const double full = 9999;`,
    `}`,
    ``,
    `/// Spacing on the theme's steps: Tailwind's p-4 is PrismSpacing.of(4).`,
    `abstract final class PrismSpacing {`,
    `  static const double unit = ${dartNumber(theme.spacing)};`,
    `  static double of(double steps) => steps * unit;`,
    `}`,
    ``,
    `/// The type scale ($h1 → PrismText.h1; also in Theme.of(context).textTheme).`,
    `abstract final class PrismText {`,
    TEXT_STYLES.map(textStyle).join("\n\n"),
    `}`,
    ``,
    `/// The app's ThemeData for a brightness, with PrismTokens as an extension.`,
    `ThemeData prismTheme(Brightness brightness) {`,
    `  final t = brightness == Brightness.dark ? PrismTokens.dark : PrismTokens.light;`,
    `  final scheme = ColorScheme(`,
    `    brightness: brightness,`,
    `    primary: t.primary,`,
    `    onPrimary: t.primaryForeground,`,
    `    secondary: t.secondary,`,
    `    onSecondary: t.secondaryForeground,`,
    `    tertiary: t.accent,`,
    `    onTertiary: t.accentForeground,`,
    `    error: t.destructive,`,
    `    onError: t.primaryForeground,`,
    `    surface: t.background,`,
    `    onSurface: t.foreground,`,
    `    surfaceContainerLow: t.card,`,
    `    surfaceContainerHighest: t.muted,`,
    `    onSurfaceVariant: t.mutedForeground,`,
    `    outline: t.input,`,
    `    outlineVariant: t.border,`,
    `  );`,
    `  final text = TextTheme(`,
    ...TEXT_STYLES.map((name) => `    ${TEXT_THEME[name]}: PrismText.${camel(name)},`),
    `  ).apply(bodyColor: t.foreground, displayColor: t.foreground);`,
    `  return ThemeData(`,
    `    useMaterial3: true,`,
    `    brightness: brightness,`,
    `    colorScheme: scheme,`,
    `    scaffoldBackgroundColor: t.background,`,
    `    dividerColor: t.border,`,
    `    textTheme: text,`,
    `    extensions: [t],`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

/** The theme in `format`, for get_theme. */
export function themeCode(theme: Theme, format: ThemeFormat) {
  switch (format) {
    case "css":
      return themeToCss(theme);
    case "css-vars":
      return themeToCssVars(theme);
    case "json":
      return JSON.stringify(themeToTokens(theme), null, 2);
    case "dart":
      return themeToDart(theme);
  }
}

/** How board tokens are written in code, per format. */
export const TOKEN_USAGE: Record<ThemeFormat, string> = {
  css: "Tailwind classes: fill $primary → bg-primary, text $muted-foreground → text-muted-foreground, stroke $border → border border-border, $radius-lg → rounded-lg, textStyle $h1 → text-h1 (plus font-heading when its font is $heading), spacing px ÷ spacing → p-4, gap-6.",
  "css-vars":
    "Plain CSS or CSS Modules: fill $primary → background: var(--primary); text $muted-foreground → color: var(--muted-foreground); stroke $border → border: 1px solid var(--border); $radius-lg → border-radius: var(--radius-lg); textStyle $h1 → class text-h1 (font, size, weight, line height and spacing); spacing → calc(var(--spacing) * 4) or px.",
  json: "Design tokens: colors[mode][token] (hex), radius[size] and spacing in px, textStyles[name] with its fontFamily. Map them to the app's own theme system.",
  dart: "Flutter: $primary → Theme.of(context).colorScheme.primary (any token: PrismTokens.of(context).mutedForeground), textStyle $h1 → PrismText.h1 (Theme.of(context).textTheme.headlineLarge), $radius-lg → BorderRadius.circular(PrismRadius.lg), spacing → EdgeInsets.all(PrismSpacing.of(4)) or the px given.",
};

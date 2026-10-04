---
target: landing, login and signup page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:F:\\Planner\\apps\\client\\src\\routes\\index.tsx"
target_fingerprint: "sha256:e81865559ff7d4b0d146a2d6fe0a58e354c112260cbde60186f9bd8781975c8b"
target_path: "F:\\Planner\\apps\\client\\src\\routes\\index.tsx"
timestamp: 2026-10-04T10-21-24Z
slug: src-routes-index-tsx
---
# Critique: landing, login, signup (source-only; browser unavailable)

## Design Health Score: 24/40 (Acceptable)
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | No success/server/OAuth-failure states; hero states unbuilt Claude feature in present tense |
| 2 | Match System / Real World | 3 | "Work email" for solo devs; "See how it works" jumps to feature grid |
| 3 | User Control and Freedom | 3 | Dead "Forgot?"; no show-password on login |
| 4 | Consistency and Standards | 2 | Three focus treatments; slogan punctuation drift; Nanum Pen vs spec's Caveat |
| 5 | Error Prevention | 2 | Checklist implies 4 rules, schema enforces length only; submit-only validation |
| 6 | Recognition Rather Than Recall | 3 | Persistent labels, LAST USED tag, visible rules |
| 7 | Flexibility and Efficiency | 3 | Good autoComplete + OAuth; mobile header hides primary CTA |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained; generic middle sections dilute |
| 9 | Error Recovery | 2 | Specific field errors; password recovery dead end; server errors undesigned |
| 10 | Help and Documentation | 1 | All footer links href="#"; no Claude Code connection guidance |

## Design Specificity Verdict
Artwork is product-specific (tool rail, Claude cursor, real MCP tool names, refraction panel). Structure is a generic SaaS template, and the token system is measured from greptile.com (index.css:4, :49). Refraction, board→code loop, and open-source/self-host are absent from the landing page. Detector: 0 findings on markup; 1 bounce-easing false positive at index.css:131 (unused animate-bounce-right token).

## Priority Issues
1. [P1] Visual identity cloned from Greptile (index.css) - derive palette from the five ray colors, replace display face and green. colorize, typeset
2. [P1] Landing never shows refraction or the board->code loop or open source - beam as section spine, loop strip, OSS line. bolder, layout
3. [P1] WCAG AA: graphite #6a6a6a on #e9e9e9 = 4.45:1; input borders ~1.5:1; Button outline-none + ring/50 (ui/button.tsx:6). audit, harden
4. [P2] Dead ends and overpromises: 9 footer href="#", Forgot? no-op, unlinked Terms/Privacy, "share the link. Nothing to install.", teams-first panel line, Coming-soon chip with no action. clarify
5. [P2] Signup friction and schema mismatch (password-strength.tsx vs auth.ts), checklist shown pre-focus, redundant confirm field; mobile CTA hidden, board preview illegible, auth panel hidden <lg. distill, adapt

## Persona Red Flags
Jordan: unexplained MCP bridge, no post-signup next step, "Work email". Sam: 50% focus rings, verbose aria-describedby on password, dead Forgot? button. Casey: no header CTA, unreadable preview, orphaned hand-note arrow. Riley: 8-char password labelled WEAK, no maxLength, LAST USED written before auth succeeds.

## Minor Observations
Duplicated cursor tone maps with mislabeled "pink"; unused type-* utilities vs ad-hoc sizes; unused .dark tokens; 124px hero gap; magic-offset cursors; static theme-color; no license/GitHub in footer.

## Questions to Consider
- Why is the refraction diagram only on auth, and hidden on mobile?
- What if Claude were the hero's protagonist, drawing a create_screen call live?
- Without Greptile tokens, what is Prism's own color logic?

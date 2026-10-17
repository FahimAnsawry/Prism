import type { Email } from "./send.js";

// One layout for every email. Inline styles only: mail clients drop <style>.
// Anything a user typed (names, board titles) goes through `esc` before it reaches the HTML.

const clientUrl = () => process.env["CLIENT_URL"] ?? "";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface Layout {
  subject: string;
  /** Short line shown in the inbox list next to the subject. */
  preview: string;
  heading: string;
  /** Paragraphs of plain text; escaped here. */
  body: string[];
  button?: { label: string; url: string };
  footer: string;
}

// The site's look (apps/client/src/index.css): canvas surface, slate text, square corners, dashed
// hairlines, a green primary button with uppercase mono text. Mail clients can't load the site's
// web fonts, so each stack lists them first and falls back to common system fonts.
const COLOR = {
  page: "#eeeeee", // fog
  card: "#fcfcfd", // canvas
  edge: "#d6d6d6", // silver
  rule: "#c5c4cc", // the dashed hairline (rule at 30% on canvas)
  ink: "#2a2a2a", // onyx: headings, wordmark
  text: "#3d3b4f", // slate
  muted: "#5f5f5f", // graphite
  brand: "#28e99f",
};
const FONT = {
  sans: "'DM Sans',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif",
  display: "'Anybody','Arial Black',Helvetica,Arial,sans-serif",
  mono: "'Space Mono',Menlo,Consolas,'Courier New',monospace",
};

function render({ subject, preview, heading, body, button, footer }: Layout) {
  const paragraphs = body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${FONT.sans};font-size:16px;line-height:1.6;color:${COLOR.text}">${esc(p)}</p>`,
    )
    .join("");
  const cta = button
    ? `<p style="margin:28px 0 20px"><a href="${esc(button.url)}" style="display:inline-block;padding:14px 24px;background:${COLOR.brand};color:${COLOR.text};font-family:${FONT.mono};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">${esc(button.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-family:${FONT.sans};font-size:13px;line-height:1.5;color:${COLOR.muted}">Button not working? Copy this link into your browser:<br><a href="${esc(button.url)}" style="color:${COLOR.text};word-break:break-all">${esc(button.url)}</a></p>`
    : "";
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">` +
    `<title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:24px 16px;background:${COLOR.page}">` +
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preview)}</span>` +
    `<div style="max-width:520px;margin:0 auto;padding:32px;background:${COLOR.card};border:1px solid ${COLOR.edge};border-top:4px solid ${COLOR.brand}">` +
    `<p style="margin:0 0 28px;font-family:${FONT.display};font-size:24px;font-weight:700;letter-spacing:-0.02em;color:${COLOR.ink}">Prism</p>` +
    `<h1 style="margin:0 0 16px;font-family:${FONT.display};font-size:30px;font-weight:700;line-height:1.1;letter-spacing:-0.02em;color:${COLOR.ink}">${esc(heading)}</h1>` +
    paragraphs +
    cta +
    `<div style="margin:24px 0 16px;border-top:1px dashed ${COLOR.rule}"></div>` +
    `<p style="margin:0;font-family:${FONT.sans};font-size:12px;line-height:1.5;color:${COLOR.muted}">${esc(footer)}</p>` +
    `</div></body></html>`;
  const text = [
    heading,
    "",
    ...body.flatMap((p) => [p, ""]),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    "—",
    footer,
  ].join("\n");
  return { subject, html, text };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function verificationEmail(user: { email: string; name: string }, url: string): Email {
  return {
    to: user.email,
    toName: user.name,
    ...render({
      subject: "Verify your email for Prism",
      preview: "Confirm your address to finish creating your account.",
      heading: "Confirm your email",
      body: [
        `Hi ${firstName(user.name)}, thanks for signing up. Confirm this address to finish creating your Prism account.`,
        "The link works for one hour.",
      ],
      button: { label: "Verify email", url },
      footer: "If you didn't create a Prism account, you can ignore this email.",
    }),
  };
}

export function welcomeEmail(user: { email: string; name: string }): Email {
  return {
    to: user.email,
    toName: user.name,
    ...render({
      subject: "Welcome to Prism",
      preview: "Your account is ready. Start your first board.",
      heading: `Welcome to Prism, ${firstName(user.name)}`,
      body: [
        "Your account is ready. Prism is a whiteboard where one idea becomes many views: wireframes, diagrams and UI references, drawn by you or by your AI editor.",
        "Open the dashboard to start your first board. To draw with Claude Code or Codex, connect it from Dashboard → Connect AI.",
      ],
      button: { label: "Open Prism", url: new URL("/dashboard", clientUrl()).toString() },
      footer: "You're getting this because you created a Prism account.",
    }),
  };
}

export function resetPasswordEmail(user: { email: string; name: string }, url: string): Email {
  return {
    to: user.email,
    toName: user.name,
    ...render({
      subject: "Reset your Prism password",
      preview: "Use this link to choose a new password.",
      heading: "Reset your password",
      body: [
        `Hi ${firstName(user.name)}, someone asked to reset the password for this Prism account. Choose a new one with the button below.`,
        "The link works for one hour and can be used once.",
      ],
      button: { label: "Choose a new password", url },
      footer: "If you didn't ask for this, ignore this email: your password stays the same.",
    }),
  };
}

export function passwordChangedEmail(user: { email: string; name: string }): Email {
  return {
    to: user.email,
    toName: user.name,
    ...render({
      subject: "Your Prism password was changed",
      preview: "If this wasn't you, reset it now.",
      heading: "Your password was changed",
      body: [
        `Hi ${firstName(user.name)}, the password for your Prism account was just changed, and you were signed out of your other devices.`,
        "If this was you, there's nothing to do. If it wasn't, reset your password now to lock the account down.",
      ],
      button: { label: "Reset password", url: new URL("/forgot-password", clientUrl()).toString() },
      footer: "This is a security notice about your Prism account.",
    }),
  };
}

export function shareInviteEmail(opts: {
  to: string;
  inviterName: string;
  kind: "board" | "project";
  itemName: string;
  role: string;
  url: string;
}): Email {
  const { to, inviterName, kind, itemName, role, url } = opts;
  const access = role === "editor" ? "edit" : "view";
  return {
    to,
    ...render({
      subject: `${inviterName} invited you to a ${kind} on Prism`,
      preview: `Open "${itemName}" on Prism.`,
      heading: `${inviterName} invited you to ${kind === "board" ? "a board" : "a project"}`,
      body: [
        `You can ${access} "${itemName}" on Prism.`,
        "Sign in, or create an account, with this email address to accept the invite.",
      ],
      button: { label: `Open ${kind}`, url },
      footer: `Sent because ${inviterName} shared a ${kind} with ${to}. If you don't know them, ignore this email.`,
    }),
  };
}

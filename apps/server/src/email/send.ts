// Transactional email through Mailjet's HTTP API (port 443: Render's free tier blocks SMTP ports).
// Without MAILJET_API_KEY (local development) the message is printed to the console instead, links
// included, so verification and reset flows can still be tried.

const MAILJET_URL = "https://api.mailjet.com/v3.1/send";
const SEND_TIMEOUT_MS = 10_000;

export interface Email {
  to: string;
  /** Recipient's display name, if known. */
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

let warnedNoKey = false;

async function deliver(email: Email) {
  const apiKey = process.env["MAILJET_API_KEY"];
  const secretKey = process.env["MAILJET_SECRET_KEY"];
  const from = process.env["EMAIL_FROM"];

  if (!apiKey || !secretKey || !from) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn(
        "[email] MAILJET_API_KEY, MAILJET_SECRET_KEY or EMAIL_FROM is not set: printing emails instead.",
      );
    }
    console.info(`[email] To: ${email.to}\n  Subject: ${email.subject}\n\n${email.text}\n`);
    return;
  }

  const response = await fetch(MAILJET_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      Messages: [
        {
          From: { Email: from, Name: process.env["EMAIL_FROM_NAME"] || "Prism" },
          To: [{ Email: email.to, ...(email.toName ? { Name: email.toName } : {}) }],
          Subject: email.subject,
          TextPart: email.text,
          HTMLPart: email.html,
        },
      ],
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Mailjet answered ${response.status}: ${await response.text()}`);
  }
}

/**
 * Sends without making the caller wait or fail: a slow or failing provider mustn't delay a
 * sign-up or reveal (through timing) whether an address has an account. Failures are logged.
 */
export function sendEmail(email: Email): void {
  deliver(email).catch((error: unknown) =>
    console.error(`[email] Couldn't send "${email.subject}" to ${email.to}:`, error),
  );
}

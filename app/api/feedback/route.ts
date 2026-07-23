import { NextResponse } from "next/server";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SUBJECTS,
  isFeedbackCategory,
} from "@/lib/feedback";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20_000;
const MAX_MESSAGE_LENGTH = 5_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;
const RATE_LIMIT_MAX = 5;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const recentSubmissions = new Map<string, number[]>();

type FeedbackPayload = {
  category?: unknown;
  contactEmail?: unknown;
  message?: unknown;
  website?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const activeAttempts = (recentSubmissions.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (activeAttempts.length >= RATE_LIMIT_MAX) {
    recentSubmissions.set(clientKey, activeAttempts);
    return true;
  }

  activeAttempts.push(now);
  recentSubmissions.set(clientKey, activeAttempts);
  return false;
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return jsonError("Požadavek nelze ověřit.", 403);
  }

  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonError("Neplatný formát zprávy.", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError("Zpráva je příliš dlouhá.", 413);
  }

  let payload: FeedbackPayload;
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return jsonError("Zpráva je příliš dlouhá.", 413);
    }
    payload = JSON.parse(rawBody) as FeedbackPayload;
  } catch {
    return jsonError("Neplatný formát zprávy.", 400);
  }

  // Honeypot: automated submissions appear successful but are not delivered.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  if (!isFeedbackCategory(payload.category)) {
    return jsonError("Vyber platný typ podnětu.", 400);
  }

  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (message.length < 10 || message.length > MAX_MESSAGE_LENGTH) {
    return jsonError("Zpráva musí mít 10 až 5 000 znaků.", 400);
  }

  const contactEmail =
    typeof payload.contactEmail === "string" ? payload.contactEmail.trim() : "";
  if (
    contactEmail &&
    (contactEmail.length > 254 || !EMAIL_PATTERN.test(contactEmail))
  ) {
    return jsonError("Zadej platný e-mail pro odpověď.", 400);
  }

  if (isRateLimited(getClientKey(request))) {
    return jsonError("Limit odeslání byl vyčerpán. Zkus to prosím později.", 429);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.FEEDBACK_RECIPIENT_EMAIL?.trim();
  const sender =
    process.env.FEEDBACK_FROM_EMAIL?.trim() ||
    "HYROX Training <onboarding@resend.dev>";

  if (!apiKey || !recipient) {
    console.error("Feedback email is not configured.", {\n      hasApiKey: Boolean(apiKey),\n      hasRecipient: Boolean(recipient),\n    });
    return jsonError("Odesílání zpráv zatím není nastavené.", 503);
  }

  const categoryLabel = FEEDBACK_CATEGORIES[payload.category];
  const subject = `[HYROX app] ${FEEDBACK_SUBJECTS[payload.category]}`;
  const text = [
    `Typ: ${categoryLabel}`,
    `Kontakt pro odpověď: ${contactEmail || "neuveden"}`,
    "",
    message,
    "",
    "Odesláno z aplikace HYROX Training.",
  ].join("\n");

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `feedback-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject,
        text,
        ...(contactEmail ? { reply_to: contactEmail } : {}),
        tags: [{ name: "category", value: payload.category }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    console.error("Feedback email provider request failed.");
    return jsonError("Zprávu se nepodařilo odeslat. Zkus to prosím později.", 502);
  }

  if (!response.ok) {
    const providerMessage = (await response.text()).slice(0, 500);
    console.error("Feedback email send failed.", {
      status: response.status,
      providerMessage,
    });
    return jsonError("Zprávu se nepodařilo odeslat. Zkus to prosím později.", 502);
  }

  return NextResponse.json({ ok: true });
}

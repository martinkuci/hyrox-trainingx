import {
  buildSupportEmailText,
  hasValidSupportAttachmentSignature,
  isSupportType,
  supportAttachmentMimeType,
  supportSubject,
  validateSupportAttachment,
  validateSupportReplyEmail,
} from "@/lib/help-support";

export const runtime = "nodejs";

const MESSAGE_MIN_LENGTH = 5;
const MESSAGE_MAX_LENGTH = 4_000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RateLimitEntry = { count: number; resetAt: number };

const rateLimits = new Map<string, RateLimitEntry>();

function jsonResponse(body: Record<string, unknown>, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const key = requestIp(request);
  const current = rateLimits.get(key);

  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  }

  current.count += 1;
  if (rateLimits.size > 1_000) {
    for (const [entryKey, entry] of rateLimits) {
      if (entry.resetAt <= now) rateLimits.delete(entryKey);
    }
  }
  return null;
}

function hasTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || request.headers.get("host")?.trim();
  if (!origin || !expectedHost) return false;

  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

function textField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeFilename(value: string, mimeType: string) {
  const extension = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  }[mimeType] ?? "";
  const cleaned = value.replace(/[\\/\r\n]/g, " ").trim().slice(0, 110) || "priloha";
  const base = cleaned.replace(/\.[a-z0-9]+$/i, "").trim() || "priloha";
  return `${base}${extension}`;
}

export async function POST(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return jsonResponse({ error: "Požadavek se nepodařilo ověřit." }, 403);
  }

  const retryAfter = checkRateLimit(request);
  if (retryAfter !== null) {
    return jsonResponse(
      { error: "Odesíláš příliš mnoho hlášení. Zkus to znovu za několik minut." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "Hlášení se nepodařilo načíst." }, 400);
  }

  if (textField(formData, "website").trim()) {
    return jsonResponse({ ok: true });
  }

  const type = textField(formData, "type");
  const message = textField(formData, "message").trim();
  const replyEmail = textField(formData, "replyEmail").trim();
  const submissionId = textField(formData, "submissionId").trim();
  const attachmentValue = formData.get("attachment");
  const attachment = attachmentValue instanceof File && attachmentValue.size > 0
    ? attachmentValue
    : null;

  if (!isSupportType(type)) {
    return jsonResponse({ error: "Vyber platný typ zprávy." }, 400);
  }
  if (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
    return jsonResponse({ error: "Zpráva musí mít 5 až 4 000 znaků." }, 400);
  }
  const replyEmailError = validateSupportReplyEmail(replyEmail);
  if (replyEmailError) {
    return jsonResponse({ error: replyEmailError }, 400);
  }
  if (!UUID_PATTERN.test(submissionId)) {
    return jsonResponse({ error: "Hlášení nemá platný identifikátor. Obnov stránku a zkus to znovu." }, 400);
  }

  let attachmentMimeType = "";
  if (attachment) {
    const attachmentError = validateSupportAttachment(attachment);
    if (attachmentError) {
      return jsonResponse({ error: attachmentError }, 400);
    }
    const signature = new Uint8Array(await attachment.slice(0, 12).arrayBuffer());
    attachmentMimeType = supportAttachmentMimeType(attachment);
    if (!hasValidSupportAttachmentSignature(signature, attachmentMimeType)) {
      return jsonResponse({ error: "Obsah přílohy neodpovídá povolenému typu souboru." }, 400);
    }
  } else if (attachmentValue instanceof File && attachmentValue.size === 0 && attachmentValue.name) {
    return jsonResponse({ error: "Vybraný soubor je prázdný." }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.SUPPORT_EMAIL_TO?.trim();
  const sender = process.env.SUPPORT_EMAIL_FROM?.trim();
  if (!apiKey || !recipient || !sender) {
    return jsonResponse({ error: "Odesílání podpory zatím není nakonfigurované." }, 503);
  }

  const attachments = attachment
    ? [{
        filename: safeFilename(attachment.name, attachmentMimeType),
        content: Buffer.from(await attachment.arrayBuffer()).toString("base64"),
      }]
    : undefined;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `support-${submissionId}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: supportSubject(type),
        text: buildSupportEmailText({ type, message, replyEmail }),
        ...(replyEmail ? { reply_to: replyEmail } : {}),
        ...(attachments ? { attachments } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      console.error("Support email provider failed", { status: response.status });
      return jsonResponse({ error: "Hlášení se nepodařilo odeslat. Zkus to znovu později." }, 502);
    }
  } catch (reason) {
    console.error("Support email request failed", {
      name: reason instanceof Error ? reason.name : "unknown",
    });
    return jsonResponse({ error: "Hlášení se nepodařilo odeslat. Zkontroluj připojení a zkus to znovu." }, 502);
  }

  return jsonResponse({ ok: true });
}

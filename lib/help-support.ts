import { APP_VERSION } from "./app-version.mjs";

export const MAX_SUPPORT_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

const SUPPORT_ATTACHMENT_TYPES = new Set(SUPPORT_ATTACHMENT_ACCEPT.split(","));
const SUPPORT_ATTACHMENT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf"]);
const SUPPORT_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

export const SUPPORT_TYPES = [
  {
    value: "technical",
    label: "Technická pomoc",
    subject: "[Enginn] Technická pomoc",
  },
  {
    value: "idea",
    label: "Nápad na zlepšení",
    subject: "[Enginn] Nápad na zlepšení",
  },
  {
    value: "question",
    label: "Obecný dotaz",
    subject: "[Enginn] Obecný dotaz",
  },
] as const;

export type SupportType = (typeof SUPPORT_TYPES)[number]["value"];

export function isSupportType(value: unknown): value is SupportType {
  return SUPPORT_TYPES.some((item) => item.value === value);
}

export function supportSubject(type: SupportType) {
  return SUPPORT_TYPES.find((item) => item.value === type)?.subject
    ?? SUPPORT_TYPES[0].subject;
}

export function validateSupportReplyEmail(value: string) {
  const email = value.trim();
  if (!email) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Zkontroluj formát kontaktního e-mailu.";
  }
  return null;
}

export function validateSupportAttachment(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) {
    return "Vybraný soubor je prázdný.";
  }
  if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return "Soubor je větší než povolené 4 MB.";
  }

  const normalizedType = file.type.toLowerCase();
  const normalizedName = file.name.toLowerCase();
  const hasAllowedExtension = [...SUPPORT_ATTACHMENT_EXTENSIONS]
    .some((extension) => normalizedName.endsWith(extension));
  if (
    !SUPPORT_ATTACHMENT_TYPES.has(normalizedType)
    && !(normalizedType === "" && hasAllowedExtension)
  ) {
    return "Použij screenshot ve formátu PNG, JPG nebo WebP, případně PDF.";
  }

  return null;
}

export function supportAttachmentMimeType(file: Pick<File, "name" | "type">) {
  const normalizedType = file.type.toLowerCase();
  if (SUPPORT_ATTACHMENT_TYPES.has(normalizedType)) return normalizedType;

  const normalizedName = file.name.toLowerCase();
  const extension = [...SUPPORT_ATTACHMENT_EXTENSIONS]
    .find((candidate) => normalizedName.endsWith(candidate));
  return extension ? SUPPORT_ATTACHMENT_MIME_BY_EXTENSION[extension] ?? "" : "";
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export function hasValidSupportAttachmentSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/png") {
    return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === "image/jpeg") {
    return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
  if (mimeType === "image/webp") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]);
  }
  if (mimeType === "application/pdf") {
    return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  return false;
}

export function buildSupportEmailText({
  type,
  message,
  replyEmail,
}: {
  type: SupportType;
  message: string;
  replyEmail: string;
}) {
  const label = SUPPORT_TYPES.find((item) => item.value === type)?.label
    ?? SUPPORT_TYPES[0].label;
  return [
    `Typ: ${label}`,
    `Kontaktní e-mail: ${replyEmail.trim() || "neuveden"}`,
    "",
    message.trim(),
    "",
    "---",
    "Odesláno z aplikace Enginn",
    `Verze ${APP_VERSION}`,
  ].join("\n");
}

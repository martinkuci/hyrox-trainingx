import { APP_VERSION } from "./app-version.mjs";

export const SUPPORT_EMAIL = "martin.kuci@gmail.com";
export const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const SUPPORT_ATTACHMENT_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

const SUPPORT_ATTACHMENT_TYPES = new Set(SUPPORT_ATTACHMENT_ACCEPT.split(","));
const SUPPORT_ATTACHMENT_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf"]);

export const SUPPORT_TYPES = [
  {
    value: "technical",
    label: "Technická pomoc",
    subject: "[HYROX Training] Technická pomoc",
  },
  {
    value: "idea",
    label: "Nápad na zlepšení",
    subject: "[HYROX Training] Nápad na zlepšení",
  },
  {
    value: "question",
    label: "Obecný dotaz",
    subject: "[HYROX Training] Obecný dotaz",
  },
] as const;

export type SupportType = (typeof SUPPORT_TYPES)[number]["value"];

export function supportSubject(type: SupportType) {
  return SUPPORT_TYPES.find((item) => item.value === type)?.subject
    ?? SUPPORT_TYPES[0].subject;
}

export function validateSupportAttachment(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) {
    return "Vybraný soubor je prázdný.";
  }
  if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return "Soubor je větší než povolených 10 MB.";
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

export function buildSupportShareText(message: string) {
  return [
    `Příjemce podpory: ${SUPPORT_EMAIL}`,
    "",
    message.trim(),
    "",
    "---",
    "Odesláno z aplikace HYROX Training",
    `Verze ${APP_VERSION}`,
  ].join("\n");
}

export function buildSupportMailto(type: SupportType, message: string) {
  const body = [
    message.trim(),
    "",
    "---",
    "Odesláno z aplikace HYROX Training",
    `Verze ${APP_VERSION}`,
  ].join("\n");
  const params = new URLSearchParams({
    subject: supportSubject(type),
    body,
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

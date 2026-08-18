import { APP_VERSION } from "./app-version.mjs";

export const SUPPORT_EMAIL = "martin.kuci@gmail.com";

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

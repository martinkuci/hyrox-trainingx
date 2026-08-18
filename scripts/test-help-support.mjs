import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SUPPORT_ATTACHMENT_BYTES,
  buildSupportEmailText,
  hasValidSupportAttachmentSignature,
  isSupportType,
  supportAttachmentMimeType,
  supportSubject,
  validateSupportAttachment,
  validateSupportReplyEmail,
} from "../lib/help-support.ts";

test("použije správný předmět pro každý typ dotazu", () => {
  assert.equal(supportSubject("technical"), "[HYROX Training] Technická pomoc");
  assert.equal(supportSubject("idea"), "[HYROX Training] Nápad na zlepšení");
  assert.equal(supportSubject("question"), "[HYROX Training] Obecný dotaz");
});

test("povolí jen známé typy hlášení", () => {
  assert.equal(isSupportType("technical"), true);
  assert.equal(isSupportType("idea"), true);
  assert.equal(isSupportType("question"), true);
  assert.equal(isSupportType("billing"), false);
});

test("ověří volitelný kontaktní e-mail", () => {
  assert.equal(validateSupportReplyEmail(""), null);
  assert.equal(validateSupportReplyEmail("martin@example.com"), null);
  assert.match(validateSupportReplyEmail("neplatny-email"), /formát/);
});

test("povolí podporovaný screenshot nebo PDF do 4 MB", () => {
  assert.equal(validateSupportAttachment({ name: "chyba.png", size: 500_000, type: "image/png" }), null);
  assert.equal(validateSupportAttachment({ name: "popis.pdf", size: MAX_SUPPORT_ATTACHMENT_BYTES, type: "application/pdf" }), null);
  assert.equal(validateSupportAttachment({ name: "screenshot.JPG", size: 1_000, type: "" }), null);
});

test("odmítne prázdnou, příliš velkou nebo nepodporovanou přílohu", () => {
  assert.match(validateSupportAttachment({ name: "chyba.png", size: 0, type: "image/png" }), /prázdný/);
  assert.match(validateSupportAttachment({ name: "chyba.png", size: MAX_SUPPORT_ATTACHMENT_BYTES + 1, type: "image/png" }), /4 MB/);
  assert.match(validateSupportAttachment({ name: "data.json", size: 1_000, type: "application/json" }), /PNG/);
});

test("doplní bezpečný MIME typ podle přípony, když jej telefon neposkytne", () => {
  assert.equal(supportAttachmentMimeType({ name: "screenshot.JPG", type: "" }), "image/jpeg");
  assert.equal(supportAttachmentMimeType({ name: "report.pdf", type: "" }), "application/pdf");
  assert.equal(supportAttachmentMimeType({ name: "data.json", type: "" }), "");
});

test("ověří skutečné signatury povolených příloh", () => {
  assert.equal(hasValidSupportAttachmentSignature(
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "image/png",
  ), true);
  assert.equal(hasValidSupportAttachmentSignature(
    Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
    "image/jpeg",
  ), true);
  assert.equal(hasValidSupportAttachmentSignature(
    Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    "image/webp",
  ), true);
  assert.equal(hasValidSupportAttachmentSignature(
    Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    "application/pdf",
  ), true);
  assert.equal(hasValidSupportAttachmentSignature(
    Uint8Array.from([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]),
    "image/png",
  ), false);
});

test("text pro podporu obsahuje typ, kontakt, zprávu a verzi bez příjemce", () => {
  const body = buildSupportEmailText({
    type: "technical",
    message: "  Po klepnutí se obrazovka zavře.  ",
    replyEmail: "martin@example.com",
  });

  assert.match(body, /^Typ: Technická pomoc/);
  assert.match(body, /Kontaktní e-mail: martin@example\.com/);
  assert.match(body, /Po klepnutí se obrazovka zavře\./);
  assert.match(body, /Odesláno z aplikace HYROX Training\nVerze 1\.0\.0$/);
  assert.doesNotMatch(body, /Příjemce podpory/);
});

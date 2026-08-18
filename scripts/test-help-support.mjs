import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_SUPPORT_ATTACHMENT_BYTES,
  SUPPORT_EMAIL,
  buildSupportMailto,
  buildSupportShareText,
  supportSubject,
  validateSupportAttachment,
} from "../lib/help-support.ts";

test("použije správný předmět pro každý typ dotazu", () => {
  assert.equal(supportSubject("technical"), "[HYROX Training] Technická pomoc");
  assert.equal(supportSubject("idea"), "[HYROX Training] Nápad na zlepšení");
  assert.equal(supportSubject("question"), "[HYROX Training] Obecný dotaz");
});

test("vytvoří bezpečný mailto odkaz s adresou, předmětem a zprávou", () => {
  const url = new URL(buildSupportMailto("idea", "  Přidejte tmavší mapu.  "));

  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, SUPPORT_EMAIL);
  assert.equal(url.searchParams.get("subject"), "[HYROX Training] Nápad na zlepšení");
  assert.match(url.searchParams.get("body"), /^Přidejte tmavší mapu\./);
  assert.match(url.searchParams.get("body"), /Odesláno z aplikace HYROX Training\nVerze 1\.0\.0$/);
});

test("prázdnou zprávu nezamění za typ dotazu", () => {
  const url = new URL(buildSupportMailto("technical", ""));

  assert.equal(url.searchParams.get("subject"), "[HYROX Training] Technická pomoc");
  assert.match(url.searchParams.get("body"), /HYROX Training/);
});

test("povolí podporovaný screenshot nebo PDF do 10 MB", () => {
  assert.equal(validateSupportAttachment({ name: "chyba.png", size: 500_000, type: "image/png" }), null);
  assert.equal(validateSupportAttachment({ name: "popis.pdf", size: MAX_SUPPORT_ATTACHMENT_BYTES, type: "application/pdf" }), null);
  assert.equal(validateSupportAttachment({ name: "screenshot.JPG", size: 1_000, type: "" }), null);
});

test("odmítne prázdnou, příliš velkou nebo nepodporovanou přílohu", () => {
  assert.match(validateSupportAttachment({ name: "chyba.png", size: 0, type: "image/png" }), /prázdný/);
  assert.match(validateSupportAttachment({ name: "chyba.png", size: MAX_SUPPORT_ATTACHMENT_BYTES + 1, type: "image/png" }), /10 MB/);
  assert.match(validateSupportAttachment({ name: "data.json", size: 1_000, type: "application/json" }), /PNG/);
});

test("text pro systémové sdílení obsahuje příjemce, zprávu a verzi", () => {
  const body = buildSupportShareText("  Po klepnutí se obrazovka zavře.  ");

  assert.match(body, new RegExp(`^Příjemce podpory: ${SUPPORT_EMAIL}`));
  assert.match(body, /Po klepnutí se obrazovka zavře\./);
  assert.match(body, /Odesláno z aplikace HYROX Training\nVerze 1\.0\.0$/);
});

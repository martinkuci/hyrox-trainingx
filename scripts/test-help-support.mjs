import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORT_EMAIL,
  buildSupportMailto,
  supportSubject,
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

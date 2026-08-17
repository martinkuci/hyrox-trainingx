import assert from "node:assert/strict";
import test from "node:test";
import { upgradeCatalogTemplates } from "../lib/catalog-migration.ts";
import { TRAINING_CATALOG, TRAINING_CATALOG_VERSION } from "../lib/training-catalog.ts";

test("updates an untouched catalog template to structured mode version 2", () => {
  const stored = structuredClone(TRAINING_CATALOG);
  const template = stored.find((item) => item.id === "catalog-strength-01");
  const mainIndex = template.blocks.findIndex((block) => block.id.endsWith("-main"));
  template.blocks[mainIndex] = {
    id: "catalog-strength-01-main",
    type: "manual",
    title: "4 kvalitní kola",
    repeat: 4,
    steps: [{ id: "legacy-rest", name: "90 s odpočinek", detail: "Další kolo." }],
  };

  const loaded = upgradeCatalogTemplates(stored, 1, TRAINING_CATALOG, TRAINING_CATALOG_VERSION);
  const upgraded = loaded.find((item) => item.id === template.id);
  assert.equal(upgraded.blocks.find((block) => block.id.endsWith("-main")).type, "for-time");
});

test("does not overwrite a user-edited catalog template", () => {
  const stored = structuredClone(TRAINING_CATALOG);
  const template = stored.find((item) => item.id === "catalog-strength-01");
  template.title = "Moje upravená síla";
  template.updatedAt = "2026-08-17T22:00:00.000Z";

  const loaded = upgradeCatalogTemplates(stored, 1, TRAINING_CATALOG, TRAINING_CATALOG_VERSION);
  const preserved = loaded.find((item) => item.id === template.id);
  assert.equal(preserved.title, "Moje upravená síla");
});

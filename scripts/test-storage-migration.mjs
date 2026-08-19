import assert from "node:assert/strict";
import test from "node:test";
import { upgradeCatalogTemplates } from "../lib/catalog-migration.ts";
import { TRAINING_CATALOG, TRAINING_CATALOG_VERSION } from "../lib/training-catalog.ts";

test("updates an untouched catalog template to the current catalog version", () => {
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

test("updates public branding without changing the legacy template id", () => {
  const stored = structuredClone(TRAINING_CATALOG);
  const template = stored.find((item) => item.id === "hyrox-02");
  template.title = "HYROX 02 · Mixed Foundation";
  template.metadata.workoutCode = "HYX-MIX-01";

  const loaded = upgradeCatalogTemplates(stored, 2, TRAINING_CATALOG, TRAINING_CATALOG_VERSION);
  const upgraded = loaded.find((item) => item.id === "hyrox-02");

  assert.equal(upgraded.id, "hyrox-02");
  assert.equal(upgraded.title, "Hybrid 02 · Mixed Foundation");
  assert.equal(upgraded.metadata.workoutCode, "EGN-MIX-01");
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

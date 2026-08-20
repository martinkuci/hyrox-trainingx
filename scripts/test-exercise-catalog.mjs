import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "lib/exercise-library.ts",
  "lib/exercise-library-extended.ts",
  "lib/exercise-library-accessories.ts",
];

const sources = files.map((file) => fs.readFileSync(path.join(root, file), "utf8"));
const ids = sources.flatMap((source) => [...source.matchAll(/\bid:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]));
const counts = new Map();
for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);

assert.equal(duplicates.length, 0, `Duplicitní exercise id: ${duplicates.join(", ")}`);
assert.ok(ids.length >= 200, `Katalog má pouze ${ids.length} cviků; očekáváno alespoň 200.`);

for (const requiredId of [
  "run", "ski-erg", "wall-ball", "push-up", "kb-swing", "db-bench-press",
  "back-squat", "pull-up", "machine-leg-press", "cable-pallof-press",
  "walk", "ab-wheel-rollout", "dead-hang", "hip-90-90",
]) {
  assert.ok(counts.has(requiredId), `V katalogu chybí ${requiredId}.`);
}

const combined = sources.join("\n");
for (const marker of ["finisher", "bodyweight", "crossfit", "machine", "prehab", "you-go-i-go"]) {
  assert.ok(combined.includes(marker), `Katalog neobsahuje očekávaný marker ${marker}.`);
}

const types = fs.readFileSync(path.join(root, "lib/types.ts"), "utf8");
for (const equipment of [
  "smith-machine", "leg-press", "lat-pulldown", "rings", "dip-bars", "ghd",
  "ab-wheel", "battle-rope", "jump-rope", "stair-climber",
]) {
  assert.ok(types.includes(`| \"${equipment}\"`), `EquipmentId neobsahuje ${equipment}.`);
}

console.log(`Exercise catalog OK: ${ids.length} unikátních cviků.`);

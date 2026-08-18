import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { APP_VERSION } from "../lib/app-version.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const packageLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

test("release candidate používá všude verzi 1.0.0", () => {
  assert.equal(APP_VERSION, "1.0.0");
  assert.equal(packageJson.version, APP_VERSION);
  assert.equal(packageLock.version, APP_VERSION);
  assert.equal(packageLock.packages[""].version, APP_VERSION);
});

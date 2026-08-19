import assert from "node:assert/strict";
import test from "node:test";
import { parseHealthActivities } from "../lib/health-data.ts";
import {
  hasRequiredStravaScopes,
  mapStravaSummaryActivity,
  parseStravaScopes,
} from "../lib/strava.ts";

const importedAt = "2026-08-20T01:00:00.000Z";

function sampleActivity(overrides = {}) {
  return {
    id: 123456789,
    name: "Morning Run",
    sport_type: "Run",
    start_date: "2026-08-19T05:30:00Z",
    elapsed_time: 2700,
    moving_time: 2500,
    distance: 10125.4,
    total_elevation_gain: 145.2,
    average_heartrate: 151.4,
    max_heartrate: 178.8,
    average_watts: 265.5,
    trainer: false,
    manual: false,
    ...overrides,
  };
}

test("parses Strava scopes from comma and whitespace separated responses", () => {
  assert.deepEqual(parseStravaScopes("read,activity:read_all"), ["read", "activity:read_all"]);
  assert.deepEqual(parseStravaScopes("read activity:read_all read"), ["read", "activity:read_all"]);
  assert.equal(hasRequiredStravaScopes("read,activity:read_all"), true);
  assert.equal(hasRequiredStravaScopes("read"), false);
});

test("maps a Strava activity into the provider-neutral Enginn model", () => {
  const activity = mapStravaSummaryActivity(sampleActivity(), importedAt);

  assert.equal(activity.id, "health-strava-123456789");
  assert.equal(activity.provider, "strava");
  assert.equal(activity.externalId, "123456789");
  assert.equal(activity.title, "Morning Run");
  assert.equal(activity.sportType, "Run");
  assert.equal(activity.startedAt, "2026-08-19T05:30:00.000Z");
  assert.equal(activity.durationSeconds, 2700);
  assert.equal(activity.movingDurationSeconds, 2500);
  assert.equal(activity.distanceKm, 10.1254);
  assert.equal(activity.elevationGainMeters, 145.2);
  assert.equal(activity.averageHeartRate, 151);
  assert.equal(activity.maxHeartRate, 179);
  assert.equal(activity.averageWatts, 265.5);
  assert.equal(activity.importedAt, importedAt);
});

test("accepts mapped Strava activities in the client-side health validation gate", () => {
  const activity = mapStravaSummaryActivity(sampleActivity(), importedAt);
  assert.deepEqual(parseHealthActivities([activity], "strava"), [activity]);
});

test("rejects malformed Strava activities before import", () => {
  assert.throws(
    () => mapStravaSummaryActivity(sampleActivity({ id: null }), importedAt),
    /missing id/,
  );
  assert.throws(
    () => mapStravaSummaryActivity(sampleActivity({ start_date: "not-a-date" }), importedAt),
    /invalid start date/,
  );
});

test("rejects an unexpected health provider before local storage", () => {
  const activity = mapStravaSummaryActivity(sampleActivity(), importedAt);
  assert.throws(
    () => parseHealthActivities([{ ...activity, provider: "apple-health" }], "strava"),
    /unexpected provider/,
  );
});

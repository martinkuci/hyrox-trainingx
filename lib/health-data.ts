import type { HealthActivity, HealthProviderId } from "./types";

export const HEALTH_PROVIDER_IDS: HealthProviderId[] = [
  "strava",
  "apple-health",
  "health-connect",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validDate(value: unknown) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function optionalNumber(value: unknown, min = 0) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= min);
}

export function isHealthActivity(value: unknown): value is HealthActivity {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    HEALTH_PROVIDER_IDS.includes(value.provider as HealthProviderId) &&
    typeof value.externalId === "string" &&
    value.externalId.length > 0 &&
    typeof value.title === "string" &&
    value.title.length > 0 &&
    typeof value.sportType === "string" &&
    value.sportType.length > 0 &&
    validDate(value.startedAt) &&
    typeof value.durationSeconds === "number" &&
    Number.isFinite(value.durationSeconds) &&
    value.durationSeconds >= 0 &&
    optionalNumber(value.movingDurationSeconds) &&
    optionalNumber(value.distanceKm) &&
    optionalNumber(value.elevationGainMeters) &&
    optionalNumber(value.averageHeartRate) &&
    optionalNumber(value.maxHeartRate) &&
    optionalNumber(value.calories) &&
    optionalNumber(value.averageWatts) &&
    (value.sourceDevice === undefined || typeof value.sourceDevice === "string") &&
    (value.trainer === undefined || typeof value.trainer === "boolean") &&
    (value.manual === undefined || typeof value.manual === "boolean") &&
    validDate(value.importedAt)
  );
}

export function parseHealthActivities(value: unknown, provider?: HealthProviderId) {
  if (!Array.isArray(value) || !value.every(isHealthActivity)) {
    throw new Error("Health activities response is invalid.");
  }
  if (provider && value.some((activity) => activity.provider !== provider)) {
    throw new Error("Health activities response contains an unexpected provider.");
  }
  return value as HealthActivity[];
}

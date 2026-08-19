import type { HealthActivity } from "./types";

export const STRAVA_REQUESTED_SCOPES = ["read", "activity:read_all"] as const;
export const STRAVA_REQUIRED_SCOPES = ["activity:read_all"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function parseStravaScopes(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))];
  }
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

export function hasRequiredStravaScopes(value: unknown) {
  const granted = new Set(parseStravaScopes(value));
  return STRAVA_REQUIRED_SCOPES.every((scope) => granted.has(scope));
}

export function mapStravaSummaryActivity(value: unknown, importedAt = new Date().toISOString()): HealthActivity {
  if (!isRecord(value)) throw new Error("Strava activity must be an object.");

  const rawId = value.id;
  const externalId =
    typeof rawId === "number" && Number.isFinite(rawId)
      ? String(Math.trunc(rawId))
      : typeof rawId === "string" && rawId.trim()
        ? rawId.trim()
        : "";
  if (!externalId) throw new Error("Strava activity is missing id.");

  const startedAt = cleanText(value.start_date);
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
    throw new Error("Strava activity has invalid start date.");
  }

  const elapsedTime = optionalFiniteNumber(value.elapsed_time);
  const movingTime = optionalFiniteNumber(value.moving_time);
  const durationSeconds = Math.max(0, Math.round(elapsedTime ?? movingTime ?? 0));
  const distanceMeters = optionalFiniteNumber(value.distance);
  const elevationGain = optionalFiniteNumber(value.total_elevation_gain);
  const averageHeartRate = optionalFiniteNumber(value.average_heartrate);
  const maxHeartRate = optionalFiniteNumber(value.max_heartrate);
  const calories = optionalFiniteNumber(value.calories);
  const averageWatts = optionalFiniteNumber(value.average_watts);

  return {
    id: `health-strava-${externalId}`,
    provider: "strava",
    externalId,
    title: cleanText(value.name, "Strava aktivita").slice(0, 160),
    sportType: cleanText(value.sport_type, cleanText(value.type, "Workout")).slice(0, 80),
    startedAt: new Date(startedAt).toISOString(),
    durationSeconds,
    ...(movingTime !== undefined ? { movingDurationSeconds: Math.max(0, Math.round(movingTime)) } : {}),
    ...(distanceMeters !== undefined ? { distanceKm: Math.max(0, distanceMeters) / 1000 } : {}),
    ...(elevationGain !== undefined ? { elevationGainMeters: Math.max(0, elevationGain) } : {}),
    ...(averageHeartRate !== undefined ? { averageHeartRate: Math.max(0, Math.round(averageHeartRate)) } : {}),
    ...(maxHeartRate !== undefined ? { maxHeartRate: Math.max(0, Math.round(maxHeartRate)) } : {}),
    ...(calories !== undefined ? { calories: Math.max(0, Math.round(calories)) } : {}),
    ...(averageWatts !== undefined ? { averageWatts: Math.max(0, averageWatts) } : {}),
    ...(cleanText(value.device_name) ? { sourceDevice: cleanText(value.device_name).slice(0, 120) } : {}),
    ...(optionalBoolean(value.trainer) !== undefined ? { trainer: optionalBoolean(value.trainer) } : {}),
    ...(optionalBoolean(value.manual) !== undefined ? { manual: optionalBoolean(value.manual) } : {}),
    importedAt,
  };
}

export function mapStravaActivities(values: unknown, importedAt = new Date().toISOString()) {
  if (!Array.isArray(values)) throw new Error("Strava activities response must be an array.");
  return values.map((value) => mapStravaSummaryActivity(value, importedAt));
}

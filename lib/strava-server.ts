import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { mapStravaActivities, parseStravaScopes } from "./strava";

export const STRAVA_TOKEN_COOKIE = "enginn-strava-token-v1";
export const STRAVA_STATE_COOKIE = "enginn-strava-state-v1";

export type VerifiedFirebaseUser = {
  uid: string;
  email?: string;
};

export type StravaTokenBundle = {
  uid: string;
  athleteId: string;
  athleteName: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
};

type StravaOAuthState = {
  uid: string;
  state: string;
  createdAt: number;
};

type StravaTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_at?: unknown;
  scope?: unknown;
  athlete?: unknown;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stravaConfiguration() {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.STRAVA_REDIRECT_URI?.trim() ?? "";
  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
  };
}

function cookieKey() {
  const { clientSecret } = stravaConfiguration();
  if (!clientSecret) throw new Error("Strava is not configured.");
  return createHash("sha256")
    .update(`enginn:strava-cookie:v1:${clientSecret}`)
    .digest();
}

function encryptCookiePayload(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cookieKey(), iv);
  const plain = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptCookiePayload<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const payload = Buffer.from(value, "base64url");
    if (payload.length < 29) return null;
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", cookieKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    return JSON.parse(plain) as T;
  } catch {
    return null;
  }
}

function secureCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function writeStravaStateCookie(value: StravaOAuthState) {
  const store = await cookies();
  store.set(STRAVA_STATE_COOKIE, encryptCookiePayload(value), secureCookieOptions(10 * 60));
}

export async function readStravaStateCookie() {
  const store = await cookies();
  return decryptCookiePayload<StravaOAuthState>(store.get(STRAVA_STATE_COOKIE)?.value);
}

export async function clearStravaStateCookie() {
  const store = await cookies();
  store.set(STRAVA_STATE_COOKIE, "", secureCookieOptions(0));
}

export async function writeStravaTokenCookie(value: StravaTokenBundle) {
  const store = await cookies();
  store.set(STRAVA_TOKEN_COOKIE, encryptCookiePayload(value), secureCookieOptions(180 * 24 * 60 * 60));
}

export async function readStravaTokenCookie() {
  const store = await cookies();
  return decryptCookiePayload<StravaTokenBundle>(store.get(STRAVA_TOKEN_COOKIE)?.value);
}

export async function clearStravaTokenCookie() {
  const store = await cookies();
  store.set(STRAVA_TOKEN_COOKIE, "", secureCookieOptions(0));
}

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey || !idToken) return null;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );
  if (!response.ok) return null;

  const body = (await response.json()) as { users?: Array<{ localId?: string; email?: string }> };
  const user = body.users?.[0];
  return user?.localId ? { uid: user.localId, email: user.email } : null;
}

export function resolveStravaRedirectUri(request: Request) {
  const configured = stravaConfiguration().redirectUri;
  if (configured) return configured;
  return new URL("/api/strava/callback", request.url).toString();
}

export function buildStravaAuthorizationUrl({
  request,
  state,
}: {
  request: Request;
  state: string;
}) {
  const { clientId } = stravaConfiguration();
  if (!clientId) throw new Error("Strava is not configured.");

  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", resolveStravaRedirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "read,activity:read_all");
  url.searchParams.set("state", state);
  return url.toString();
}

function athleteSummary(value: unknown) {
  if (!isRecord(value)) return { id: "", name: "Strava sportovec" };
  const id =
    typeof value.id === "number" && Number.isFinite(value.id)
      ? String(Math.trunc(value.id))
      : typeof value.id === "string"
        ? value.id.trim()
        : "";
  const first = typeof value.firstname === "string" ? value.firstname.trim() : "";
  const last = typeof value.lastname === "string" ? value.lastname.trim() : "";
  const name = [first, last].filter(Boolean).join(" ") || "Strava sportovec";
  return { id, name };
}

function parseTokenResponse(value: StravaTokenResponse, uid: string, previous?: StravaTokenBundle): StravaTokenBundle {
  const accessToken = typeof value.access_token === "string" ? value.access_token : "";
  const refreshToken = typeof value.refresh_token === "string" ? value.refresh_token : "";
  const expiresAt = typeof value.expires_at === "number" && Number.isFinite(value.expires_at)
    ? Math.trunc(value.expires_at)
    : 0;
  if (!accessToken || !refreshToken || !expiresAt) throw new Error("Invalid Strava token response.");

  const athlete = athleteSummary(value.athlete);
  const scopes = parseStravaScopes(value.scope);
  return {
    uid,
    athleteId: athlete.id || previous?.athleteId || "",
    athleteName: athlete.name === "Strava sportovec" ? previous?.athleteName ?? athlete.name : athlete.name,
    accessToken,
    refreshToken,
    expiresAt,
    scopes: scopes.length > 0 ? scopes : previous?.scopes ?? [],
  };
}

async function tokenRequest(params: URLSearchParams) {
  const { clientId, clientSecret } = stravaConfiguration();
  if (!clientId || !clientSecret) throw new Error("Strava is not configured.");
  params.set("client_id", clientId);
  params.set("client_secret", clientSecret);

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Strava token request failed with ${response.status}.`);
  return (await response.json()) as StravaTokenResponse;
}

export async function exchangeStravaCode(code: string, uid: string) {
  const body = await tokenRequest(new URLSearchParams({
    code,
    grant_type: "authorization_code",
  }));
  return parseTokenResponse(body, uid);
}

export async function refreshStravaToken(token: StravaTokenBundle, force = false) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!force && token.expiresAt > nowSeconds + 3600) {
    return { token, refreshed: false };
  }

  const body = await tokenRequest(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  }));
  return {
    token: parseTokenResponse(body, token.uid, token),
    refreshed: true,
  };
}

async function requestActivities(accessToken: string) {
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "30");
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

export async function fetchRecentStravaActivities(initialToken: StravaTokenBundle) {
  let refreshed = await refreshStravaToken(initialToken);
  let token = refreshed.token;
  let response = await requestActivities(token.accessToken);

  if (response.status === 401) {
    refreshed = await refreshStravaToken(token, true);
    token = refreshed.token;
    response = await requestActivities(token.accessToken);
  }
  if (!response.ok) throw new Error(`Strava activities request failed with ${response.status}.`);

  const importedAt = new Date().toISOString();
  return {
    token,
    tokenChanged: token.accessToken !== initialToken.accessToken || token.refreshToken !== initialToken.refreshToken,
    importedAt,
    activities: mapStravaActivities(await response.json(), importedAt),
  };
}

export async function revokeStravaToken(token: StravaTokenBundle) {
  const { clientId, clientSecret } = stravaConfiguration();
  if (!clientId || !clientSecret) return false;

  const authorization = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  const response = await fetch("https://www.strava.com/oauth/revoke", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: token.refreshToken,
      token_type_hint: "refresh_token",
    }),
    cache: "no-store",
  });
  return response.ok;
}

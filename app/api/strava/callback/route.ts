import { timingSafeEqual } from "node:crypto";
import { hasRequiredStravaScopes, parseStravaScopes } from "@/lib/strava";
import {
  clearStravaStateCookie,
  exchangeStravaCode,
  readStravaStateCookie,
  revokeStravaToken,
  stravaConfiguration,
  writeStravaTokenCookie,
} from "@/lib/strava-server";

export const runtime = "nodejs";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function redirectToHealth(request: Request, status: string) {
  return Response.redirect(new URL(`/account/health?strava=${encodeURIComponent(status)}`, request.url));
}

function statesMatch(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export async function GET(request: Request) {
  if (!stravaConfiguration().configured) {
    await clearStravaStateCookie();
    return redirectToHealth(request, "not-configured");
  }

  const url = new URL(request.url);
  const providerError = url.searchParams.get("error");
  if (providerError) {
    await clearStravaStateCookie();
    return redirectToHealth(request, providerError === "access_denied" ? "denied" : "oauth-error");
  }

  const code = url.searchParams.get("code")?.trim() ?? "";
  const returnedState = url.searchParams.get("state")?.trim() ?? "";
  const storedState = await readStravaStateCookie();
  const stateFresh = Boolean(
    storedState &&
    Number.isFinite(storedState.createdAt) &&
    Date.now() - storedState.createdAt >= 0 &&
    Date.now() - storedState.createdAt <= STATE_MAX_AGE_MS,
  );

  if (!code || !returnedState || !storedState || !stateFresh || !statesMatch(storedState.state, returnedState)) {
    await clearStravaStateCookie();
    return redirectToHealth(request, "invalid-state");
  }

  try {
    const token = await exchangeStravaCode(code, storedState.uid);
    const callbackScopes = parseStravaScopes(url.searchParams.get("scope"));
    const effectiveScopes = callbackScopes.length > 0 ? callbackScopes : token.scopes;
    const tokenWithScopes = { ...token, scopes: effectiveScopes };

    if (!hasRequiredStravaScopes(effectiveScopes)) {
      await revokeStravaToken(tokenWithScopes);
      await clearStravaStateCookie();
      return redirectToHealth(request, "missing-scope");
    }

    await writeStravaTokenCookie(tokenWithScopes);
    await clearStravaStateCookie();
    return redirectToHealth(request, "connected");
  } catch {
    await clearStravaStateCookie();
    return redirectToHealth(request, "exchange-failed");
  }
}

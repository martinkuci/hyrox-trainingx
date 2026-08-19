import {
  bearerToken,
  readStravaTokenCookie,
  stravaConfiguration,
  verifyFirebaseIdToken,
} from "@/lib/strava-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const configuration = stravaConfiguration();
  if (!configuration.configured) {
    return Response.json({
      configured: false,
      connected: false,
    });
  }

  const user = await verifyFirebaseIdToken(bearerToken(request));
  if (!user) {
    return Response.json(
      { error: "Pro kontrolu Stravy se nejdřív přihlas ke cloudovému účtu Enginn." },
      { status: 401 },
    );
  }

  const token = await readStravaTokenCookie();
  const connected = Boolean(token && token.uid === user.uid);

  return Response.json({
    configured: true,
    connected,
    ...(connected && token
      ? {
          athleteName: token.athleteName,
          scopes: token.scopes,
          expiresAt: token.expiresAt,
        }
      : {}),
  });
}

import {
  bearerToken,
  clearStravaTokenCookie,
  readStravaTokenCookie,
  revokeStravaToken,
  stravaConfiguration,
  verifyFirebaseIdToken,
} from "@/lib/strava-server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!stravaConfiguration().configured) {
    return errorResponse("Strava zatím není na serveru nakonfigurovaná.", 503);
  }

  const user = await verifyFirebaseIdToken(bearerToken(request));
  if (!user) {
    return errorResponse("Pro odpojení Stravy se nejdřív přihlas ke cloudovému účtu Enginn.", 401);
  }

  const token = await readStravaTokenCookie();
  if (!token || token.uid !== user.uid) {
    await clearStravaTokenCookie();
    return Response.json({ disconnected: true });
  }

  try {
    const revoked = await revokeStravaToken(token);
    if (!revoked) {
      return errorResponse("Stravu se nepodařilo bezpečně odpojit. Zkus to znovu později.", 502);
    }
    await clearStravaTokenCookie();
    return Response.json({ disconnected: true });
  } catch {
    return errorResponse("Stravu se nepodařilo bezpečně odpojit. Zkus to znovu později.", 502);
  }
}

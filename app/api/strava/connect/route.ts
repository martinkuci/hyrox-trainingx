import { randomBytes } from "node:crypto";
import {
  bearerToken,
  buildStravaAuthorizationUrl,
  stravaConfiguration,
  verifyFirebaseIdToken,
  writeStravaStateCookie,
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
    return errorResponse("Pro připojení Stravy se nejdřív přihlas ke cloudovému účtu Enginn.", 401);
  }

  const state = randomBytes(24).toString("base64url");
  await writeStravaStateCookie({
    uid: user.uid,
    state,
    createdAt: Date.now(),
  });

  return Response.json({
    authorizationUrl: buildStravaAuthorizationUrl({ request, state }),
  });
}

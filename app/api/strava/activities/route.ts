import { hasRequiredStravaScopes } from "@/lib/strava";
import {
  bearerToken,
  fetchRecentStravaActivities,
  readStravaTokenCookie,
  stravaConfiguration,
  verifyFirebaseIdToken,
  writeStravaTokenCookie,
} from "@/lib/strava-server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function GET(request: Request) {
  if (!stravaConfiguration().configured) {
    return errorResponse("Strava zatím není na serveru nakonfigurovaná.", 503);
  }

  const user = await verifyFirebaseIdToken(bearerToken(request));
  if (!user) {
    return errorResponse("Pro synchronizaci Stravy se nejdřív přihlas ke cloudovému účtu Enginn.", 401);
  }

  const token = await readStravaTokenCookie();
  if (!token || token.uid !== user.uid) {
    return errorResponse("Strava není pro tento účet připojená.", 401);
  }
  if (!hasRequiredStravaScopes(token.scopes)) {
    return errorResponse("Strava nemá oprávnění číst všechny tréninkové aktivity. Připoj ji znovu.", 403);
  }

  try {
    const result = await fetchRecentStravaActivities(token);
    if (result.tokenChanged) await writeStravaTokenCookie(result.token);

    return Response.json({
      athleteName: result.token.athleteName,
      importedAt: result.importedAt,
      activities: result.activities,
    });
  } catch {
    return errorResponse("Aktivity ze Stravy se teď nepodařilo načíst. Zkus synchronizaci znovu později.", 502);
  }
}

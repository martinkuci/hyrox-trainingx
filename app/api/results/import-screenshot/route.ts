type JsonRecord = Record<string, unknown>;

type ExtractedResult = {
  workoutTitle: string;
  completedAt: string | null;
  durationSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  distanceKm: number | null;
  rpe: number | null;
  weights: string;
  notes: string;
  confidence: number;
  warnings: string[];
};

const MAX_DATA_URL_LENGTH = 4_000_000;
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function openAiErrorCode(value: unknown) {
  const body = objectValue(value);
  const error = objectValue(body?.error);
  return typeof error?.code === "string"
    ? error.code
    : typeof error?.type === "string"
      ? error.type
      : "";
}

function openAiFailureMessage(status: number, code: string) {
  if (status === 401) {
    return "OpenAI API klíč není platný. Zkontroluj hodnotu OPENAI_API_KEY pro Vercel Preview a spusť nový deployment.";
  }
  if (status === 403) {
    return "OpenAI projekt nemá oprávnění použít zvolený model. Zkontroluj oprávnění API klíče a projektu.";
  }
  if (status === 404 || code === "model_not_found") {
    return "Zvolený OpenAI model není pro tento projekt dostupný. Zkontroluj OPENAI_VISION_MODEL ve Vercelu.";
  }
  if (status === 429 && code === "insufficient_quota") {
    return "OpenAI projekt nemá dostupný kredit nebo má vyčerpanou kvótu. Zkontroluj Billing a Usage Limits.";
  }
  if (status === 429) {
    return "OpenAI API právě překročilo limit požadavků. Po chvíli zkus import znovu.";
  }
  if (status === 400) {
    return "OpenAI odmítlo požadavek na analýzu. Zkontroluj nastavený vision model a zkus import znovu.";
  }
  return "Automatické čtení screenshotu se nepodařilo. Zkus to znovu později.";
}

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function nullableNumber(value: unknown, min: number, max: number) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error("Invalid numeric value");
  }
  return value;
}

function nullableInteger(value: unknown, min: number, max: number) {
  const number = nullableNumber(value, min, max);
  if (number !== null && !Number.isInteger(number)) throw new Error("Invalid integer value");
  return number;
}

function validateExtractedResult(value: unknown): ExtractedResult {
  const data = objectValue(value);
  if (!data) throw new Error("Invalid extraction");

  const completedAt = data.completedAt;
  if (
    completedAt !== null &&
    (typeof completedAt !== "string" || Number.isNaN(Date.parse(completedAt)))
  ) {
    throw new Error("Invalid date");
  }

  if (typeof data.workoutTitle !== "string") throw new Error("Invalid title");
  if (typeof data.weights !== "string") throw new Error("Invalid weights");
  if (typeof data.notes !== "string") throw new Error("Invalid notes");
  if (!Array.isArray(data.warnings) || !data.warnings.every((item) => typeof item === "string")) {
    throw new Error("Invalid warnings");
  }

  return {
    workoutTitle: data.workoutTitle.trim().slice(0, 120),
    completedAt,
    durationSeconds: nullableInteger(data.durationSeconds, 1, 86_400),
    averageHeartRate: nullableInteger(data.averageHeartRate, 20, 260),
    maxHeartRate: nullableInteger(data.maxHeartRate, 20, 260),
    calories: nullableInteger(data.calories, 0, 20_000),
    distanceKm: nullableNumber(data.distanceKm, 0, 1_000),
    rpe: nullableInteger(data.rpe, 1, 10),
    weights: data.weights.trim().slice(0, 300),
    notes: data.notes.trim().slice(0, 1_000),
    confidence: nullableNumber(data.confidence, 0, 1) ?? 0,
    warnings: data.warnings.slice(0, 8).map((item) => item.slice(0, 180)),
  };
}

function findOutputText(value: unknown) {
  const body = objectValue(value);
  if (!body || !Array.isArray(body.output)) return null;

  for (const item of body.output) {
    const output = objectValue(item);
    if (!output || !Array.isArray(output.content)) continue;
    for (const content of output.content) {
      const part = objectValue(content);
      if (part?.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }

  return null;
}

async function verifyFirebaseUser(idToken: string, apiKey: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );

  if (!response.ok) return false;
  const body = (await response.json()) as { users?: Array<{ localId?: string }> };
  return Boolean(body.users?.[0]?.localId);
}

export async function POST(request: Request) {
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!firebaseApiKey || !openAiApiKey) {
    return errorResponse("Import screenshotu zatím není na serveru nakonfigurovaný.", 503);
  }

  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!idToken || !(await verifyFirebaseUser(idToken, firebaseApiKey))) {
    return errorResponse("Pro import screenshotu se nejdřív přihlas ke cloudovému účtu.", 401);
  }

  let body: JsonRecord | null = null;
  try {
    body = objectValue(await request.json());
  } catch {
    return errorResponse("Screenshot se nepodařilo načíst.", 400);
  }

  const imageDataUrl = body?.imageDataUrl;
  if (
    typeof imageDataUrl !== "string" ||
    imageDataUrl.length > MAX_DATA_URL_LENGTH ||
    !IMAGE_DATA_URL.test(imageDataUrl)
  ) {
    return errorResponse("Použij obrázek PNG, JPEG nebo WebP do 6 MB.", 400);
  }

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-5.6-luna";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1_000,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract only values explicitly visible in this fitness workout screenshot. " +
                "Do not estimate values from charts. Convert duration to total seconds and distance to kilometres. " +
                "Use an ISO 8601 completedAt value only when the date and time are visible; otherwise return null. " +
                "RPE is usually not present, so return null unless explicitly shown. " +
                "Put short uncertain or unmapped details into warnings. Return Czech notes.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "hyrox_screenshot_result",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              workoutTitle: { type: "string" },
              completedAt: { type: ["string", "null"] },
              durationSeconds: { type: ["integer", "null"] },
              averageHeartRate: { type: ["integer", "null"] },
              maxHeartRate: { type: ["integer", "null"] },
              calories: { type: ["integer", "null"] },
              distanceKm: { type: ["number", "null"] },
              rpe: { type: ["integer", "null"] },
              weights: { type: "string" },
              notes: { type: "string" },
              confidence: { type: "number" },
              warnings: { type: "array", items: { type: "string" } },
            },
            required: [
              "workoutTitle",
              "completedAt",
              "durationSeconds",
              "averageHeartRate",
              "maxHeartRate",
              "calories",
              "distanceKm",
              "rpe",
              "weights",
              "notes",
              "confidence",
              "warnings",
            ],
          },
        },
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    let code = "";
    try {
      code = openAiErrorCode(await response.json());
    } catch {
      // The status code still provides a safe user-facing fallback.
    }
    console.error("OpenAI screenshot import failed", {
      status: response.status,
      code: code || "unknown",
    });
    return errorResponse(openAiFailureMessage(response.status, code), 502);
  }

  try {
    const responseBody = await response.json();
    const outputText = findOutputText(responseBody);
    if (!outputText) throw new Error("Missing model output");
    return Response.json({ result: validateExtractedResult(JSON.parse(outputText)) });
  } catch {
    return errorResponse("Rozpoznané údaje se nepodařilo bezpečně zpracovat.", 502);
  }
}

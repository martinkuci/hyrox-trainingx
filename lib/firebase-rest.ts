import type { HyroxData } from "./types";

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

const AUTH_KEY = "hyrox-firebase-auth-v1";
export const AUTH_EVENT = "hyrox-auth-change";

export type CloudUser = {
  uid: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type IdentityResponse = {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

type FirebaseError = {
  error?: { message?: string };
};

function ensureConfigured() {
  if (!API_KEY || !PROJECT_ID) throw new Error("Firebase není nakonfigurovaný.");
}

function authStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function saveUser(user: CloudUser | null) {
  const storage = authStorage();
  if (storage) {
    if (user) storage.setItem(AUTH_KEY, JSON.stringify(user));
    else storage.removeItem(AUTH_KEY);
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export function loadCloudUser(): CloudUser | null {
  const storage = authStorage();
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(AUTH_KEY) ?? "null") as CloudUser | null;
    return value?.uid && value.idToken ? value : null;
  } catch {
    return null;
  }
}

function friendlyError(message = "UNKNOWN") {
  const code = message.split(" : ")[0];
  const messages: Record<string, string> = {
    EMAIL_EXISTS: "Účet s tímto e-mailem už existuje.",
    INVALID_LOGIN_CREDENTIALS: "Nesprávný e-mail nebo heslo.",
    INVALID_EMAIL: "E-mail nemá platný formát.",
    WEAK_PASSWORD: "Heslo musí mít alespoň 6 znaků.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Příliš mnoho pokusů. Zkus to později.",
    USER_DISABLED: "Tento účet je zablokovaný.",
  };
  return messages[code] ?? `Přihlášení selhalo: ${code}`;
}

async function identityRequest(path: string, email: string, password: string) {
  ensureConfigured();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = (await response.json()) as IdentityResponse & FirebaseError;
  if (!response.ok) throw new Error(friendlyError(body.error?.message));
  const user: CloudUser = {
    uid: body.localId,
    email: body.email,
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    expiresAt: Date.now() + Number(body.expiresIn) * 1000,
  };
  saveUser(user);
  return user;
}

export function signInWithEmail(email: string, password: string) {
  return identityRequest("signInWithPassword", email.trim(), password);
}

export function createEmailAccount(email: string, password: string) {
  return identityRequest("signUp", email.trim(), password);
}

export function signOutCloud() {
  saveUser(null);
}

async function validUser() {
  const user = loadCloudUser();
  if (!user) return null;
  if (user.expiresAt > Date.now() + 60_000) return user;

  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.refreshToken }),
  });
  const body = await response.json();
  if (!response.ok) {
    signOutCloud();
    return null;
  }
  const refreshed: CloudUser = {
    uid: body.user_id,
    email: user.email,
    idToken: body.id_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + Number(body.expires_in) * 1000,
  };
  saveUser(refreshed);
  return refreshed;
}

function documentUrl(uid: string) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
}

export async function downloadCloudData(): Promise<HyroxData | null> {
  const user = await validUser();
  if (!user) return null;
  const response = await fetch(documentUrl(user.uid), {
    headers: { Authorization: `Bearer ${user.idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Cloudová data se nepodařilo načíst.");
  const body = await response.json();
  const payload = body.fields?.payload?.stringValue;
  if (typeof payload !== "string") return null;
  return JSON.parse(payload) as HyroxData;
}

export async function uploadCloudData(data: HyroxData) {
  const user = await validUser();
  if (!user) return false;
  const response = await fetch(documentUrl(user.uid), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${user.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        payload: { stringValue: JSON.stringify(data) },
        updatedAt: { timestampValue: new Date().toISOString() },
        email: { stringValue: user.email },
      },
    }),
  });
  if (!response.ok) throw new Error("Cloudová data se nepodařilo uložit.");
  return true;
}

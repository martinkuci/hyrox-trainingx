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
  expiresAt
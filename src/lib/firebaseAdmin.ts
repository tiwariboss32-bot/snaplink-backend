import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";
import { env } from "./env";

let messaging: Messaging | null = null;

export function getFirebaseMessaging(): Messaging | null {
  if (messaging) return messaging;

  const path = resolve(env.firebaseServiceAccountPath);
  if (!existsSync(path)) {
    console.warn(`Firebase service account not found at ${path}; push notifications are disabled.`);
    return null;
  }

  const serviceAccount = JSON.parse(readFileSync(path, "utf-8"));

  const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  messaging = getMessaging(app);
  return messaging;
}

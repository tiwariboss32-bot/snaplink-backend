import { getFirebaseMessaging } from "./firebaseAdmin";
import { prisma } from "./prisma";

interface SendPushNotificationArgs {
  userId: string;
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

const INVALID_TOKEN_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export async function sendPushNotification({
  userId,
  pushToken,
  title,
  body,
  data,
}: SendPushNotificationArgs): Promise<void> {
  const messaging = getFirebaseMessaging();
  if (!messaging) return;

  try {
    await messaging.send({
      token: pushToken,
      notification: { title, body },
      data,
      android: { priority: "high" },
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code && INVALID_TOKEN_ERRORS.has(code)) {
      await prisma.user.update({ where: { id: userId }, data: { pushToken: null } }).catch(() => {});
      return;
    }
    console.error("Failed to send push notification", err);
  }
}

import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  // Short-lived now that refresh tokens exist; long-lived sessions come from
  // rotating the refresh token instead of a long-lived access token.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  refreshTokenExpiresInDays: Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS ?? 30),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
  },
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "./secrets/firebase-service-account.json",
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
    region: process.env.AWS_REGION ?? "",
    bucket: process.env.AWS_S3_BUCKET ?? "",
    // Optional CDN/custom domain in front of the bucket (e.g. CloudFront).
    // Falls back to the bucket's default virtual-hosted-style URL.
    publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL ?? "",
  },
};

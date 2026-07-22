import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

let client: S3Client | null = null;

export function getS3(): S3Client {
  if (!env.aws.accessKeyId || !env.aws.secretAccessKey || !env.aws.region || !env.aws.bucket) {
    throw new Error(
      "S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION and AWS_S3_BUCKET in .env"
    );
  }
  if (!client) {
    client = new S3Client({
      region: env.aws.region,
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey,
      },
    });
  }
  return client;
}

export function publicUrlForKey(key: string): string {
  if (env.aws.publicBaseUrl) {
    return `${env.aws.publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `https://${env.aws.bucket}.s3.${env.aws.region}.amazonaws.com/${key}`;
}

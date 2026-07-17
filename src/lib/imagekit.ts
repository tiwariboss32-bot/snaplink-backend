import ImageKit from "imagekit";
import { env } from "./env";

let client: ImageKit | null = null;

export function getImageKit(): ImageKit {
  if (!env.imagekit.publicKey || !env.imagekit.privateKey || !env.imagekit.urlEndpoint) {
    throw new Error(
      "ImageKit is not configured. Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT in .env"
    );
  }
  if (!client) {
    client = new ImageKit({
      publicKey: env.imagekit.publicKey,
      privateKey: env.imagekit.privateKey,
      urlEndpoint: env.imagekit.urlEndpoint,
    });
  }
  return client;
}

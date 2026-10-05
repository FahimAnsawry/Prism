import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { HttpError } from "./errors.js";

// Object storage for uploaded images, configured only by the provider-neutral S3_* env vars
// (Neon Object Storage by default, Cloudflare R2 by changing values; see .env.example).

interface Storage {
  client: S3Client;
  bucket: string;
}

let storage: Storage | null | undefined;

/** The configured bucket, or null when the S3_* vars aren't all set. */
function getStorage() {
  if (storage !== undefined) return storage;
  const env = process.env;
  const endpoint = env["S3_ENDPOINT"];
  const region = env["S3_REGION"];
  const accessKeyId = env["S3_ACCESS_KEY_ID"];
  const secretAccessKey = env["S3_SECRET_ACCESS_KEY"];
  const bucket = env["S3_BUCKET"];
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    console.warn("[Prism] S3_* env vars are incomplete; image uploads are disabled.");
    storage = null;
    return storage;
  }
  storage = {
    bucket,
    client: new S3Client({
      endpoint,
      region,
      forcePathStyle: env["S3_FORCE_PATH_STYLE"] === "true",
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return storage;
}

function requireStorage() {
  const configured = getStorage();
  if (!configured) throw new HttpError(503, "Image uploads aren't set up on this server yet.");
  return configured;
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  const { client, bucket } = requireStorage();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

/** The object's bytes and type, or null if there's no such key. */
export async function getObject(key: string) {
  const { client, bucket } = requireStorage();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) return null;
    // Reading the stream to the end also frees the socket.
    const bytes = await object.Body.transformToByteArray();
    return { bytes, contentType: object.ContentType };
  } catch (error) {
    if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NotFound")) {
      return null;
    }
    throw error;
  }
}

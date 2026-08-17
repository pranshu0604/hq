// Object storage — one interface, three backends, picked by what's configured:
//   • R2   → Cloudflare R2 (S3-compatible) if the R2_* env vars are set
//   • DB   → images live in Turso as blobs when hosted (TURSO_DATABASE_URL set) —
//            no object store, no credit card; fine for occasional pasted images
//   • disk → local ./uploads folder (Mac dev, before switching to Turso)
// Uploaded images go through putObject; the /media route reads via getObject.
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

const R2_BUCKET = process.env.R2_BUCKET;
const useR2 = !!(R2_BUCKET && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
const useDb = !useR2 && !!process.env.TURSO_DATABASE_URL;

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });
  }
  return s3;
}

const localPath = (name: string) => path.join(process.cwd(), "uploads", name);

export async function putObject(name: string, buf: Buffer, contentType: string): Promise<void> {
  if (useR2) {
    await client().send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: name, Body: buf, ContentType: contentType }));
    return;
  }
  if (useDb) {
    const data = new Uint8Array(buf);
    await prisma.blob.upsert({ where: { name }, create: { name, contentType, data }, update: { data, contentType } });
    return;
  }
  await mkdir(path.dirname(localPath(name)), { recursive: true });
  await writeFile(localPath(name), buf);
}

export async function getObject(name: string): Promise<{ body: Uint8Array; contentType?: string } | null> {
  if (useR2) {
    try {
      const res = await client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: name }));
      const body = await res.Body?.transformToByteArray();
      return body ? { body, contentType: res.ContentType } : null;
    } catch {
      return null;
    }
  }
  if (useDb) {
    const row = await prisma.blob.findUnique({ where: { name } });
    return row ? { body: new Uint8Array(row.data), contentType: row.contentType } : null;
  }
  try {
    const buf = await readFile(localPath(name));
    return { body: new Uint8Array(buf) };
  } catch {
    return null;
  }
}

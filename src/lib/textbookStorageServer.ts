import "server-only";
import type { NextApiRequest } from "next";
import { getStorage } from "firebase-admin/storage";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import adminApp, { adminAuth, adminDb } from "@/lib/firebaseAdmin";

const MAX_SIZE = 50 * 1024 * 1024;
export interface TextbookFile {
  filepath: string;
  size: number;
  originalFilename: string | null;
  mimetype: string | null;
}
export class TextbookRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export async function requireTextbookAdmin(req: NextApiRequest): Promise<string> {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization ?? "");
  if (!match) throw new TextbookRequestError(401, "Hãy đăng nhập lại trước khi nhập SGK.");
  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(match[1], true)).uid;
  } catch {
    throw new TextbookRequestError(401, "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.");
  }
  const user = await adminDb.collection("users").doc(uid).get();
  if (user.data()?.role !== "admin" || user.data()?.status !== "active") {
    throw new TextbookRequestError(403, "Chỉ quản trị viên đang hoạt động được nhập SGK.");
  }
  return uid;
}

export async function downloadTextbook(uid: string, storagePath: string): Promise<TextbookFile> {
  const prefix = `textbooks/${uid}/`;
  const fileId = storagePath.slice(prefix.length);
  if (!storagePath.startsWith(prefix) || !/^[a-f0-9-]{36}\.pdf$/.test(fileId)) {
    throw new TextbookRequestError(400, "Đường dẫn SGK không hợp lệ hoặc không thuộc tài khoản này.");
  }
  const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET)?.trim();
  if (!bucketName || bucketName.includes("://") || bucketName.includes("/")) {
    throw new TextbookRequestError(500, "Kiểm tra biến NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET trên website.");
  }
  const bucket = getStorage(adminApp).bucket(bucketName);
  const file = bucket.file(storagePath);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch {
    throw new TextbookRequestError(502, "Không đọc được SGK trong Firebase Storage. Kiểm tra bucket và quyền tài khoản dịch vụ.");
  }
  const size = Number(metadata.size);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE || metadata.contentType !== "application/pdf") {
    throw new TextbookRequestError(400, "SGK phải là PDF không vượt quá 50 MB.");
  }
  // Pin the version inspected above so a replaced object cannot bypass the size check.
  const version = bucket.file(storagePath, { generation: metadata.generation });
  const [buffer] = await version.download();
  if (buffer.length !== size || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new TextbookRequestError(400, "Nội dung SGK không phải PDF hợp lệ.");
  }
  const filepath = path.join(os.tmpdir(), `edubank-sgk-${randomUUID()}.pdf`);
  try {
    await fs.writeFile(filepath, buffer, { flag: "wx" });
  } catch (error) {
    await fs.unlink(filepath).catch(() => undefined);
    throw error;
  }
  return {
    filepath, size, mimetype: "application/pdf",
    originalFilename: String(metadata.metadata?.originalName ?? "sgk.pdf"),
  };
}

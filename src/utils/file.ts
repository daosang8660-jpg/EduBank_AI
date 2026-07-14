import path from "path";
import fs from "fs-extra";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const DOCUMENT_DIR = path.join(UPLOAD_DIR, "documents");

export const IMAGE_DIR = path.join(UPLOAD_DIR, "images");

export const TEMP_DIR = path.join(UPLOAD_DIR, "temp");

export async function ensureUploadFolders() {
  await fs.ensureDir(DOCUMENT_DIR);
  await fs.ensureDir(IMAGE_DIR);
  await fs.ensureDir(TEMP_DIR);
}
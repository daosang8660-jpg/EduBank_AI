import "server-only";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
if (!projectId) throw new Error("Thiếu FIREBASE_ADMIN_PROJECT_ID.");

// Vercel: use server-only environment variables. Local: retain the existing JSON path.
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
const privateKeyInput = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const hasPrivateKey = typeof privateKeyInput === "string" && privateKeyInput.trim().length > 0;
let account: Record<string, unknown>;

if (clientEmail || hasPrivateKey) {
  if (!clientEmail || !hasPrivateKey) {
    throw new Error("Cần cấu hình đủ FIREBASE_ADMIN_CLIENT_EMAIL và FIREBASE_ADMIN_PRIVATE_KEY trên máy chủ.");
  }
  account = {
    type: "service_account",
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKeyInput,
  };
} else {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentialsPath) {
    throw new Error("Thiếu thông tin Firebase Admin. Trên Vercel đặt FIREBASE_ADMIN_CLIENT_EMAIL và FIREBASE_ADMIN_PRIVATE_KEY; trên máy có thể dùng GOOGLE_APPLICATION_CREDENTIALS trỏ tới JSON hiện có.");
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(credentialsPath, "utf8").replace(/^\uFEFF/, ""));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    account = parsed as Record<string, unknown>;
  } catch {
    throw new Error("Không đọc được JSON Firebase Admin. Kiểm tra đường dẫn GOOGLE_APPLICATION_CREDENTIALS và định dạng tệp; không cần gửi nội dung tệp.");
  }
}

if (account.type !== "service_account") {
  throw new Error("Firebase Admin cần service account, không phải cấu hình Firebase Web hoặc OAuth của người dùng.");
}
if (account.project_id !== projectId) {
  throw new Error("Dự án trong JSON Firebase Admin không khớp FIREBASE_ADMIN_PROJECT_ID.");
}
if (typeof account.client_email !== "string" || !account.client_email.trim() ||
    typeof account.private_key !== "string") {
  throw new Error("Thông tin Firebase Admin thiếu client_email hoặc private_key hợp lệ.");
}
// Accept a multiline PEM or literal \n pasted into a server environment variable.
const privateKey = account.private_key.replace(/\\n/g, "\n").trim() + "\n";
if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.includes("-----END PRIVATE KEY-----")) {
  throw new Error("FIREBASE_ADMIN_PRIVATE_KEY hoặc private_key trong JSON chưa đúng định dạng PEM.");
}

const name = "edubank-server";
const existing = getApps().find((app) => app.name === name);
if (existing && existing.options.projectId !== projectId) {
  throw new Error("Firebase Admin đang giữ cấu hình dự án khác. Dừng hẳn server và chạy lại, hoặc redeploy trên Vercel.");
}

function createServerApp() {
  try {
    return initializeApp({
      projectId,
      credential: cert({ projectId, clientEmail: String(account.client_email).trim(), privateKey }),
    }, name);
  } catch {
    // Do not expose SDK error details, PEM values or local credential paths.
    throw new Error("Không khởi tạo được Firebase Admin. Kiểm tra dự án, email service account và định dạng khóa riêng trên máy chủ.");
  }
}

const adminApp = existing ?? createServerApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
export default adminApp;

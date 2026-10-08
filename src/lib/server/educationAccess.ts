import type { NextApiRequest, NextApiResponse } from "next";
import type { Firestore } from "firebase-admin/firestore";

export class AccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface EducationActor {
  uid: string; role: "admin" | "teacher"; subjects: string[]; grades: number[]; db: Firestore;
}
import { subjectKey } from "@/lib/education/subject";
export { subjectKey } from "@/lib/education/subject";
export function inScope(actor: EducationActor, subject: unknown, grade: unknown): boolean {
  return actor.role === "admin" || (actor.subjects.includes(subjectKey(subject)) && actor.grades.includes(Number(grade)));
}
export async function authenticate(req: NextApiRequest): Promise<EducationActor> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !/^Bearer\s+\S+$/i.test(header)) throw new AccessError(401, "Vui lòng đăng nhập.");
  // Import inside the handler: configuration errors must return JSON, never a Next.js HTML error page.
  const { adminAuth, adminDb } = await import("@/lib/firebaseAdmin");
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(header.replace(/^Bearer\s+/i, ""), true)).uid; }
  catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    const serverFailure = ["app/invalid-credential", "auth/invalid-credential", "auth/insufficient-permission", "auth/internal-error", "UNKNOWN"].includes(code);
    throw new AccessError(serverFailure ? 500 : 401, serverFailure
      ? "Firebase Admin chưa xác thực được. Kiểm tra service account, đường dẫn JSON và dự án máy chủ."
      : "Phiên đăng nhập không hợp lệ. Hãy đăng xuất rồi đăng nhập lại.");
  }
  const snapshot = await adminDb.collection("users").doc(uid).get();
  const profile = snapshot.data();
  if (!snapshot.exists || !profile || profile.status !== "active" || !["admin", "teacher"].includes(profile.role))
    throw new AccessError(403, "Tài khoản chưa được cấp quyền hoặc đã bị khóa.");
  return { uid, role:profile.role, db:adminDb,
    subjects:Array.isArray(profile.subjectCodes) ? profile.subjectCodes.map(subjectKey).filter(Boolean) : [],
    grades:Array.isArray(profile.gradeLevels) ? profile.gradeLevels.map(Number).filter(Number.isInteger) : [] };
}
export function requireAdmin(actor: EducationActor) {
  if (actor.role !== "admin") throw new AccessError(403, "Chỉ quản trị viên được thực hiện thao tác này.");
}
export function safeId(value: unknown, label="Mã bản ghi"): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || /[\/\\]/.test(value) || [".",".."].includes(value.trim()))
    throw new AccessError(400, `${label} không hợp lệ.`);
  return value.trim();
}
export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccessError(400, "Dữ liệu không hợp lệ.");
  return value as Record<string,unknown>;
}
export function timestampDTO(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value &&
      typeof value.toDate === "function" && "seconds" in value &&
      Number.isInteger(value.seconds)) {
    return { seconds:value.seconds, nanoseconds:"nanoseconds" in value ? value.nanoseconds : 0 };
  }
  return value;
}
export function fieldsDTO(data: object, fields: string[]): Record<string,unknown> {
  return Object.fromEntries(fields.filter(k=>(data as Record<string,unknown>)[k] !== undefined).map(k=>[k,timestampDTO((data as Record<string,unknown>)[k])]));
}
export function apiFailure(res: NextApiResponse, error: unknown) {
  if (error instanceof AccessError) return res.status(error.status).json({ success:false, message:error.message });
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
  console.error("education-api-error", { code:/^[\w/-]{1,80}$/.test(code) ? code : "UNKNOWN" });
  return res.status(500).json({ success:false, message:"Không xử lí được dữ liệu trên máy chủ. Kiểm tra cấu hình Firebase Admin và log terminal." });
}
export function method(req: NextApiRequest, res: NextApiResponse, allowed: string[]) {
  res.setHeader("Cache-Control", "private, no-store");
  if (allowed.includes(req.method ?? "")) return true;
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ success:false, message:"Phương thức không được hỗ trợ." });
  return false;
}

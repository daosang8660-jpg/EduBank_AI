import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { DriveSetupError, removeDriveFile, saveDriveFile } from "./driveExamStorage";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ message: "Chỉ hỗ trợ POST." }); }
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Bạn chưa đăng nhập." });
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    const profile = await adminDb.collection("users").doc(decoded.uid).get();
    if (profile.data()?.role !== "admin" || profile.data()?.status !== "active")
      return res.status(403).json({ message: "Chỉ quản trị viên được lưu đề." });
    const b = req.body ?? {};
    const examName = clean(b.examName, 200), subjectId = clean(b.subjectId, 60);
    const subjectName = clean(b.subjectName, 100), academicYear = clean(b.academicYear, 20);
    const grade = Number(b.grade), duration = Number(b.duration);
    const semester = clean(b.semester, 1), examPeriod = clean(b.examPeriod, 8), examDate = clean(b.examDate, 10);
    const questions = b.questions;
    if (!examName || !subjectId || !subjectName || !/^\d{4}-\d{4}$/.test(academicYear) ||
      !Number.isInteger(grade) || grade < 6 || grade > 9 || !Number.isInteger(duration) || duration < 1 || duration > 300 ||
      !["1", "2"].includes(semester) || !["midterm", "final"].includes(examPeriod) ||
      (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) ||
      !Array.isArray(questions) || !questions.length || questions.length > 150 ||
      questions.some((q: Record<string, unknown>) => !q || typeof q.id !== "string" || !clean(q.question, 10000) ||
        !Array.isArray(q.options) || q.options.length > 10 || q.options.some((o: unknown) => typeof o !== "string") ||
        typeof q.correctAnswer !== "string" || !Number.isFinite(q.score)))
      return res.status(400).json({ message: "Thông tin đề hoặc câu hỏi không hợp lệ." });
    if (!Array.isArray(b.specification) || b.specification.length > 200)
      return res.status(400).json({ message: "Ma trận không hợp lệ." });

    const headerHtml = `<h1>${escapeHtml(examName)}</h1><p>${escapeHtml(subjectName)} · Lớp ${grade} · ${duration} phút · ${escapeHtml(academicYear)} · ${examPeriod === "midterm" ? "Giữa" : "Cuối"} học kỳ ${semester}${examDate ? ` · ${escapeHtml(examDate)}` : ""}</p>`;
    const bodyHtml = questions.map((q: { question: string; score: number; options: string[] }, i: number) => `<section><p><strong>Câu ${i + 1}. ${escapeHtml(q.question)}</strong> (${escapeHtml(q.score)} điểm)</p>${q.options.map((o: string, j: number) => `<p>${String.fromCharCode(65 + j)}. ${escapeHtml(o)}</p>`).join("")}</section>`).join("");
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(examName)}</title><style>body{font:16px/1.5 Arial,sans-serif;max-width:800px;margin:40px auto}section{break-inside:avoid;margin:20px 0}@media print{body{margin:15mm}}</style></head><body>${headerHtml}${bodyHtml}</body></html>`;
    const payload = { examName, subjectId, subjectName, grade, duration, academicYear, semester,
      examPeriod, examDate: examDate || null, questions, specification: b.specification };
    const doc = adminDb.collection("submitted_exams").doc();
    const htmlBytes = Buffer.from(html, "utf8"), jsonBytes = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
    let examDriveId: string | null = null, matrixDriveId: string | null = null;
    try {
      examDriveId = await saveDriveFile({ name: "de-thi.html", extension: "html", bytes: htmlBytes }, "text/html", doc.id, "exam");
      matrixDriveId = await saveDriveFile({ name: "du-lieu-de.json", extension: "json", bytes: jsonBytes }, "application/json", doc.id, "matrix");
      await doc.set({ ...payload, source: "admin_generated", status: "pending_admin_review", storage: "google_drive",
        teacherName: "Nhà trường", examFile: { name: "de-thi.html", driveId: examDriveId, size: htmlBytes.length },
        matrixFile: { name: "du-lieu-de.json", driveId: matrixDriveId, size: jsonBytes.length },
        createdBy: decoded.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    } catch (error) {
      await Promise.all([...(examDriveId ? [removeDriveFile(examDriveId)] : []), ...(matrixDriveId ? [removeDriveFile(matrixDriveId)] : [])]);
      throw error;
    }
    return res.status(201).json({ id: doc.id });
  } catch (error) {
    if (error instanceof DriveSetupError) return res.status(503).json({ message: error.message });
    console.error("Không thể lưu đề sinh từ ma trận:", error);
    return res.status(500).json({ message: "Không lưu được đề lên Drive. Xem lỗi trong terminal." });
  }
}

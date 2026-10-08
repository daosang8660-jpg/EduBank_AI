import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import adminApp, { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { DriveSetupError, getDriveFile } from "./driveExamStorage";

const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ message: "Phương thức không được hỗ trợ." });
  }
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Bạn chưa đăng nhập." });
    const decoded = await adminAuth.verifyIdToken(header.slice(7), true);
    const user = await adminDb.collection("users").doc(decoded.uid).get();
    if (user.data()?.role !== "admin" || user.data()?.status !== "active") {
      return res.status(403).json({ message: "Chỉ tài khoản quản trị được xử lý đề." });
    }
    const id = req.query.id;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(id)) {
      return res.status(400).json({ message: "Mã đề không hợp lệ." });
    }
    if (req.query.source === "generated") {
      if (req.method !== "GET") return res.status(405).json({ message: "Đề tạo trên web chỉ hỗ trợ xem tại đây." });
      const generatedSnapshot = await adminDb.collection("exams").doc(id).get();
      if (!generatedSnapshot.exists) return res.status(404).json({ message: "Không tìm thấy đề." });
      const exam = generatedSnapshot.data()!;
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).json({ exam: {
        id, examName: exam.examName, subjectName: exam.subjectName, grade: exam.grade,
        duration: exam.duration, totalScore: exam.totalScore, matrix: exam.matrix ?? [],
        questions: exam.questions ?? [], examCodes: exam.examCodes ?? [],
      } });
    }
    const ref = adminDb.collection("submitted_exams").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ message: "Không tìm thấy đề kiểm tra." });
    const data = snapshot.data()!;
    if (req.method === "PATCH") {
      const status = req.body?.status;
      if (!["pending_admin_review", "needs_revision", "approved"].includes(status)) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ." });
      }
      await ref.update({ status, reviewedBy: decoded.uid, reviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ id, status });
    }
    const kind = req.query.kind;
    if (kind !== "exam" && kind !== "matrix") return res.status(400).json({ message: "Loại tệp không hợp lệ." });
    const file = kind === "exam" ? data.examFile : data.matrixFile;
    if (!file || typeof file.name !== "string") {
      return res.status(404).json({ message: "Không tìm thấy tệp." });
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const filename = String(file.name).replace(/[\r\n"\\/]/g, "_");
    if (typeof file.driveId === "string") {
      const bytes = await getDriveFile(file.driveId);
      res.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).send(bytes);
    }
    if (typeof file.path !== "string" || !file.path.startsWith(`submitted_exams/${id}/`)) {
      return res.status(404).json({ message: "Không tìm thấy tệp lưu trữ." });
    }
    res.setHeader("Content-Type", contentTypes[extension] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader("Cache-Control", "private, no-store");
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) return res.status(503).json({ message: "Chưa cấu hình FIREBASE_STORAGE_BUCKET." });
    const stream = getStorage(adminApp).bucket(bucketName).file(file.path).createReadStream();
    stream.on("error", (error) => {
      console.error("Không tải được tệp đề:", error);
      if (!res.headersSent) res.status(500).json({ message: "Không tải được tệp đề." });
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    if (error instanceof DriveSetupError) return res.status(503).json({ message: error.message });
    console.error("Không xử lý được đề:", error);
    if (!res.headersSent) return res.status(500).json({ message: "Không thể xử lý đề kiểm tra." });
  }
}

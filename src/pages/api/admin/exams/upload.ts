import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { authenticate, requireAdmin, AccessError, apiFailure } from "@/lib/server/educationAccess";
import { DriveSetupError, saveDriveFile, removeDriveFile } from "./driveExamStorage";

export const config = { api: { bodyParser: { sizeLimit: "14mb" } } };

const types: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

function parseFile(value: unknown, allowed: string[], maxBytes: number) {
  if (!value || typeof value !== "object") throw new Error("Thiếu tệp tải lên.");
  const { name, data } = value as Record<string, unknown>;
  if (typeof name !== "string" || typeof data !== "string" || name.length > 200) throw new Error("Tên hoặc dữ liệu tệp không hợp lệ.");
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (!allowed.includes(extension) || data.length > Math.ceil(maxBytes * 4 / 3) + 8 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
    throw new Error("Định dạng hoặc kích thước tệp không hợp lệ.");
  }
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new Error("Tệp rỗng hoặc quá dung lượng.");
  const valid = extension === "pdf" ? bytes.subarray(0, 5).toString() === "%PDF-" :
    extension === "xls" ? bytes.subarray(0, 4).toString("hex") === "d0cf11e0" :
    bytes.subarray(0, 2).toString() === "PK";
  if (!valid) throw new Error("Nội dung tệp không đúng định dạng.");
  return { name: name.replace(/[\\/\x00-\x1f]/g, "_").trim(), extension, bytes };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Chỉ hỗ trợ POST." });
  }
  try {
    const actor=await authenticate(req); requireAdmin(actor);
    const adminDb=actor.db, decoded={uid:actor.uid};
    const body = req.body ?? {};
    const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const examName = clean(body.examName, 200);
    const teacherName = clean(body.teacherName, 150);
    const subjectId = clean(body.subjectId, 60);
    const grade = Number(body.grade);
    const duration = Number(body.duration);
    const academicYear = clean(body.academicYear, 20);
    const semester = clean(body.semester, 1);
    const examPeriod = clean(body.examPeriod, 8);
    const examDate = clean(body.examDate, 10);
    if (!examName || !teacherName || !subjectId || !/^[\p{L}\p{N}_-]+$/u.test(subjectId) ||
      !Number.isInteger(grade) || grade < 6 || grade > 9 || !Number.isInteger(duration) || duration < 1 || duration > 300 ||
      !/^\d{4}-\d{4}$/.test(academicYear) || !["1", "2"].includes(semester) || !["midterm", "final"].includes(examPeriod) || (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate))) {
      return res.status(400).json({ message: "Thông tin đề hoặc kỳ kiểm tra không hợp lệ." });
    }
    const exam = parseFile(body.exam, ["docx", "pdf"], 6 * 1024 * 1024);
    const matrix = body.matrix ? parseFile(body.matrix, ["docx", "pdf", "xlsx", "xls"], 3 * 1024 * 1024) : null;
    const provider = process.env.EXAM_UPLOAD_PROVIDER?.trim() || "google_drive";
    if (!["google_drive", "firebase_storage"].includes(provider)) return res.status(503).json({message:"EXAM_UPLOAD_PROVIDER phải là google_drive hoặc firebase_storage."});
    const doc = adminDb.collection("submitted_exams").doc();
    const metadata = { examName, teacherName, subjectId, grade, duration, academicYear, semester, examPeriod, examDate:examDate || null,
      source:"teacher_upload", status:"pending_admin_review", createdBy:decoded.uid,
      createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() };
    if (provider === "google_drive") {
      let examDriveId:string|null=null, matrixDriveId:string|null=null;
      try {
        examDriveId=await saveDriveFile(exam,types[exam.extension],doc.id,"exam");
        if(matrix) matrixDriveId=await saveDriveFile(matrix,types[matrix.extension],doc.id,"matrix");
        await doc.set({...metadata,storage:"google_drive",
          examFile:{name:exam.name,driveId:examDriveId,size:exam.bytes.length},
          matrixFile:matrix && matrixDriveId ? {name:matrix.name,driveId:matrixDriveId,size:matrix.bytes.length} : null});
      } catch(error) {
        await Promise.allSettled([...(examDriveId?[removeDriveFile(examDriveId)]:[]),...(matrixDriveId?[removeDriveFile(matrixDriveId)]:[])]);
        throw error;
      }
    } else {
      // Explicit legacy option. No automatic fallback to a bucket that may not exist.
      const bucketName=process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      if(!bucketName) return res.status(503).json({message:"Chưa cấu hình Firebase Storage bucket."});
      const bucket=getStorage((await import("@/lib/firebaseAdmin")).default).bucket(bucketName);
      const prefix=`submitted_exams/${doc.id}`, examPath=`${prefix}/exam.${exam.extension}`;
      const matrixPath=matrix?`${prefix}/matrix.${matrix.extension}`:null;
      try {
        await bucket.file(examPath).save(exam.bytes,{resumable:false,contentType:types[exam.extension],metadata:{cacheControl:"private, no-store"}});
        if(matrix && matrixPath) await bucket.file(matrixPath).save(matrix.bytes,{resumable:false,contentType:types[matrix.extension],metadata:{cacheControl:"private, no-store"}});
        await doc.set({...metadata,storage:"firebase_storage",examFile:{name:exam.name,path:examPath,size:exam.bytes.length},
          matrixFile:matrix && matrixPath?{name:matrix.name,path:matrixPath,size:matrix.bytes.length}:null});
      } catch(error) {
        await Promise.allSettled([bucket.file(examPath).delete(),...(matrixPath?[bucket.file(matrixPath).delete()]:[])]);
        throw error;
      }
    }
    return res.status(201).json({ id: doc.id, status: "pending_admin_review" });
  } catch (error) {
    if (error instanceof AccessError) return apiFailure(res,error);
    if (error instanceof DriveSetupError) return res.status(503).json({message:error.message});
    if (error instanceof Error && /Thiếu tệp|Tên hoặc|Định dạng|Tệp rỗng|Nội dung tệp/.test(error.message)) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Không thể lưu đề giáo viên:", {code:typeof error === "object" && error !== null && "code" in error ? String(error.code) : "UNKNOWN"});
    return res.status(500).json({ message: "Không thể lưu tệp đề. Kiểm tra quyền Drive hoặc cấu hình nơi lưu tệp trong terminal." });
  }
}

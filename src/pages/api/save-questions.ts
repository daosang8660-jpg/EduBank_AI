import type { NextApiRequest, NextApiResponse } from "next";
import { createHash, randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

class SaveError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const TYPES = ["multiple_choice", "true_false", "short_answer", "essay"];
const LEVELS = ["recognition", "understanding", "application", "high_application"];
const SOURCES = ["ai", "teacher_upload", "manual"];
function text(value: unknown, label: string, required = true, max = 20000): string {
  if (typeof value !== "string") {
    if (!required && value == null) return "";
    throw new SaveError(400, `${label} không hợp lệ.`);
  }
  const result = value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if ((required && !result) || result.length > max) throw new SaveError(400, `${label} thiếu hoặc quá dài.`);
  return result;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SaveError(400, "Dữ liệu câu hỏi không hợp lệ.");
  return value as Record<string, unknown>;
}
function key(value: string): string {
  const n = value.trim().replace(/đ/gi, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "").toUpperCase();
  const aliases: Record<string,string> = { TIN:"TINHOC", GDCD:"GIAODUCCONGDAN", KHTN:"KHOAHOCTUNHIEN", NV:"NGUVAN", T:"TOAN", LSDL:"LICHSUVADIALI" };
  return aliases[n] ?? n;
}
async function actor(req: NextApiRequest) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !/^Bearer\s+\S+$/i.test(header)) throw new SaveError(401, "Bạn cần đăng nhập để lưu câu hỏi.");
  let uid: string;
  try { uid = (await adminAuth.verifyIdToken(header.replace(/^Bearer\s+/i, ""), true)).uid; }
  catch { throw new SaveError(401, "Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại."); }
  const snap = await adminDb.collection("users").doc(uid).get();
  const profile = snap.data();
  if (!snap.exists || !profile || profile.status !== "active" || !["admin","teacher"].includes(profile.role)) {
    throw new SaveError(403, "Tài khoản chưa được cấp quyền hoặc đã bị khóa.");
  }
  return { uid, profile };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success:false, message:"Chỉ hỗ trợ POST." });
  }
  try {
    const { uid, profile } = await actor(req);
    const body = object(req.body);
    if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 450) {
      throw new SaveError(400, "Mỗi lần lưu từ 1 đến 450 câu hỏi.");
    }
    const requestId = body.requestId === undefined ? randomUUID() : text(body.requestId, "Mã lượt lưu", true, 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new SaveError(400, "Mã lượt lưu không hợp lệ.");
    const lessons = new Map<string, Record<string, unknown> | null>();
    const rows: Record<string, unknown>[] = [];
    for (const value of body.questions) {
      const q = object(value);
      const sourceQuestionId = text(q.id, "Mã câu hỏi nguồn", true, 300);
      const lessonCode = text(q.lessonCode, "Mã bài", true, 200);
      if (lessonCode.includes("/")) throw new SaveError(400, "Mã bài không hợp lệ.");
      if (!lessons.has(lessonCode)) {
        const snap = await adminDb.collection("knowledge_repository").doc(lessonCode).get();
        lessons.set(lessonCode, snap.exists ? snap.data() ?? null : null);
      }
      const lesson = lessons.get(lessonCode);
      const sourceType = q.sourceType === undefined ? "ai" : q.sourceType;
      if (typeof sourceType !== "string" || !SOURCES.includes(sourceType)) throw new SaveError(400, "Nguồn câu hỏi không hợp lệ.");
      // AI questions must reference saved knowledge. Admin can also import/manual
      // questions without knowledge; teachers always need an assigned saved lesson.
      if (!lesson && (sourceType === "ai" || profile.role === "teacher")) {
        throw new SaveError(400, "Bài học chưa có học liệu được lưu trong hệ thống.");
      }
      const subject = text(lesson ? lesson.subject : q.subject, "Môn học", true, 200);
      const grade = Number(lesson ? lesson.grade : q.grade);
      if (!Number.isInteger(grade) || grade < 6 || grade > 9) throw new SaveError(400, "Khối lớp phải từ 6 đến 9.");
      const lessonTitle = text(lesson ? lesson.lessonTitle : q.lessonTitle, "Tên bài", true, 1000);
      const chapterTitle = text(lesson ? lesson.chapterTitle : q.chapterTitle, "Tên chương", true, 1000);
      if (profile.role === "teacher") {
        const subjects = Array.isArray(profile.subjectCodes) ? profile.subjectCodes
          .filter((v: unknown): v is string => typeof v === "string").map(key) : [];
        const grades = Array.isArray(profile.gradeLevels) ? profile.gradeLevels.map(Number) : [];
        if (lesson?.status !== "published" || !subjects.includes(key(subject)) || !grades.includes(grade)) {
          throw new SaveError(403, "Bài học nằm ngoài phân công hoặc chưa được xuất bản.");
        }
      }
      if (typeof q.type !== "string" || !TYPES.includes(q.type) || typeof q.level !== "string" || !LEVELS.includes(q.level)) {
        throw new SaveError(400, "Dạng hoặc mức độ câu hỏi không hợp lệ.");
      }
      const question = text(q.question, "Nội dung câu hỏi");
      const correctAnswer = text(q.correctAnswer, "Đáp án");
      if (q.options !== undefined && !Array.isArray(q.options)) throw new SaveError(400, "Phương án phải là danh sách.");
      const options: string[] = Array.isArray(q.options) ? q.options.map(v => text(v, "Phương án")) : [];
      if (q.type === "multiple_choice" && (options.length !== 4 || new Set(options).size !== 4 || !options.includes(correctAnswer))) {
        throw new SaveError(400, "Trắc nghiệm cần 4 phương án khác nhau và đáp án khớp một phương án.");
      }
      if (q.type === "true_false" && !["Đúng","Sai"].includes(correctAnswer)) throw new SaveError(400, "Đáp án Đúng/Sai không hợp lệ.");
      if (q.sourceKnowledgeIds !== undefined && !Array.isArray(q.sourceKnowledgeIds)) throw new SaveError(400, "Nguồn tri thức không hợp lệ.");
      const sourceKnowledgeIds = Array.isArray(q.sourceKnowledgeIds) ? q.sourceKnowledgeIds.map(v => text(v, "Mã tri thức", true, 300)) : [];
      rows.push({ sourceQuestionId, subject, grade, chapterTitle, lessonCode, lessonTitle,
        type:q.type, level:q.level, question, options:q.type === "true_false" ? ["Đúng","Sai"] : options,
        correctAnswer, explanation:text(q.explanation, "Giải thích", false), sourceKnowledgeIds,
        sourceType, createdBy:uid, status:"approved" });
    }
    if (Buffer.byteLength(JSON.stringify(rows), "utf8") > 2 * 1024 * 1024) throw new SaveError(413, "Lượt lưu quá lớn. Hãy chia thành nhóm nhỏ hơn.");
    const fingerprint = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    const marker = adminDb.collection("users").doc(uid).collection("question_save_requests").doc(requestId);
    const refs = rows.map(() => adminDb.collection("question_bank").doc());
    const result = await adminDb.runTransaction(async transaction => {
      const prior = await transaction.get(marker);
      if (prior.exists) {
        if (prior.get("fingerprint") !== fingerprint) throw new SaveError(409, "Mã lượt lưu đã dùng cho nội dung khác. Hãy thực hiện lượt lưu mới.");
        return prior.get("result");
      }
      const savedItems = rows.map((row, index) => ({ sourceQuestionId:row.sourceQuestionId, bankQuestionId:refs[index].id }));
      const savedResult = { success:true, total:rows.length, ids:refs.map(ref => ref.id), savedItems,
        message:`Đã lưu ${rows.length} câu hỏi vào ngân hàng.` };
      rows.forEach((row, index) => transaction.create(refs[index], { ...row, id:refs[index].id,
        createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() }));
      transaction.create(marker, { fingerprint, result:savedResult, createdAt:FieldValue.serverTimestamp() });
      return savedResult;
    });
    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof SaveError) return res.status(error.status).json({ success:false, message:error.message });
    console.error("Lỗi lưu câu hỏi:", { code: typeof error === "object" && error !== null && "code" in error ? String(error.code) : "UNKNOWN" });
    return res.status(500).json({ success:false, message:"Chưa xác nhận lưu được câu hỏi. Hãy thử lại cùng lượt lưu." });
  }
}
export const config = { api: { bodyParser: { sizeLimit:"3mb" } } };

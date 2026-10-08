import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

// Chức trách không thay đổi role Firebase/Firestore: tổ trưởng vẫn là teacher.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ success: false, message: "Chỉ hỗ trợ PATCH." });
  }
  try {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Bạn chưa đăng nhập." });
    }
    const decoded = await adminAuth.verifyIdToken(authorization.slice(7).trim());
    const adminProfile = await adminDb.collection("users").doc(decoded.uid).get();
    if (adminProfile.data()?.role !== "admin" || adminProfile.data()?.status !== "active") {
      return res.status(403).json({ success: false, message: "Bạn không có quyền phân công tài khoản." });
    }
    const uid = req.query.uid;
    if (typeof uid !== "string" || !uid) {
      return res.status(400).json({ success: false, message: "Thiếu mã tài khoản." });
    }
    const { position, subjectCodes, gradeLevels } = req.body ?? {};
    if (position !== "teacher" && position !== "subject_lead") {
      return res.status(400).json({ success: false, message: "Chức trách không hợp lệ." });
    }
    if (!Array.isArray(subjectCodes) || !subjectCodes.every((item) => typeof item === "string")) {
      return res.status(400).json({ success: false, message: "Danh sách môn không hợp lệ." });
    }
    if (!Array.isArray(gradeLevels) || !gradeLevels.every((grade) =>
      Number.isInteger(grade) && grade >= 6 && grade <= 9)) {
      return res.status(400).json({ success: false, message: "Danh sách khối không hợp lệ." });
    }
    const normalizedSubjects = [...new Set(subjectCodes.map((code: string) => code.trim().toUpperCase()).filter(Boolean))];
    const normalizedGrades = [...new Set<number>(gradeLevels)].sort((a, b) => a - b);
    if (position === "subject_lead" && normalizedSubjects.length === 0) {
      return res.status(400).json({ success: false, message: "Tổ trưởng cần được phân công ít nhất một môn." });
    }
    const ref = adminDb.collection("users").doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ success: false, message: "Không tìm thấy tài khoản." });
    if (snapshot.data()?.role !== "teacher") {
      return res.status(403).json({ success: false, message: "Chỉ được phân công tài khoản giáo viên." });
    }
    await ref.update({ position, subjectCodes: normalizedSubjects, gradeLevels: normalizedGrades,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: decoded.uid });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Cập nhật phân công thất bại:", error);
    return res.status(500).json({ success: false, message: "Không thể cập nhật phân công tài khoản." });
  }
}

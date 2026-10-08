import type { NextApiRequest, NextApiResponse } from "next";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Chỉ hỗ trợ GET." });
  }
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Bạn chưa đăng nhập." });
    const decoded = await adminAuth.verifyIdToken(header.slice(7));
    const user = await adminDb.collection("users").doc(decoded.uid).get();
    if (user.data()?.role !== "admin" || user.data()?.status !== "active") {
      return res.status(403).json({ message: "Chỉ tài khoản quản trị được xem đề." });
    }
    const snapshot = await adminDb.collection("submitted_exams").orderBy("createdAt", "desc").limit(100).get();
    const exams = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        examName: data.examName ?? "",
        teacherName: data.teacherName ?? "",
        subjectId: data.subjectId ?? "",
        grade: data.grade ?? null,
        academicYear: data.academicYear ?? "",
        semester: data.semester ?? "",
        examPeriod: data.examPeriod ?? null,
        examDate: data.examDate ?? null,
        status: data.status ?? "pending_admin_review",
        examFileName: data.examFile?.name ?? "",
        matrixFileName: data.matrixFile?.name ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        reviewedAt: data.reviewedAt?.toDate?.()?.toISOString() ?? null,
      };
    });
    return res.status(200).json({ exams, limited: snapshot.size === 100 });
  } catch (error) {
    console.error("Không tải được danh sách đề:", error);
    return res.status(500).json({ message: "Không tải được danh sách đề kiểm tra." });
  }
}

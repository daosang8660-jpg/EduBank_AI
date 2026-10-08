import type { NextApiRequest, NextApiResponse } from "next";
import { authenticate, apiFailure, method, AccessError, inScope, fieldsDTO } from "@/lib/server/educationAccess";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!method(req,res,["GET"])) return;
  try {
    const actor = await authenticate(req);
    const { subjectCode, grade } = req.query;
    if ((subjectCode !== undefined && (typeof subjectCode !== "string" || !subjectCode.trim() || subjectCode.length>100)) ||
        (grade !== undefined && (typeof grade !== "string" || !/^\d+$/.test(grade) || Number(grade)<1 || Number(grade)>12)))
      throw new AccessError(400,"Bộ lọc Curriculum không hợp lệ.");
    // Normalize validated query values before entering the Firestore callback.
    const normalizedSubjectCode = typeof subjectCode === "string"
      ? subjectCode.trim().toUpperCase() : undefined;
    const normalizedGrade = typeof grade === "string" ? Number(grade) : undefined;
    const snapshot = await actor.db.collection("curriculums").get();
    const curriculums = snapshot.docs.flatMap(doc => {
      const d = doc.data();
      if (!(inScope(actor,d.subjectCode,d.grade) || inScope(actor,d.subjectName,d.grade))) return [];
      if (normalizedSubjectCode !== undefined &&
          (typeof d.subjectCode !== "string" || d.subjectCode.trim().toUpperCase() !== normalizedSubjectCode)) return [];
      if (normalizedGrade !== undefined && Number(d.grade) !== normalizedGrade) return [];
      return [{ ...fieldsDTO(d,["subjectId","subjectCode","subjectName","grade","curriculumVersion","sourceBookId","chapters","status","createdAt","updatedAt"]),id:doc.id }];
    });
    return res.status(200).json({success:true,curriculums});
  } catch(error) { return apiFailure(res,error); }
}

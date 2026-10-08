import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { authenticate, requireAdmin, apiFailure, method, AccessError, objectBody, safeId, subjectKey } from "@/lib/server/educationAccess";
export const config={api:{bodyParser:{sizeLimit:"2mb"}}};
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if(!method(req,res,["POST"])) return;
  try {
    const actor=await authenticate(req); requireAdmin(actor);
    const input=objectBody(req.body), code=safeId(input.lessonCode,"Mã bài học");
    for(const field of ["lessonTitle","subject","chapterTitle"])
      if(typeof input[field]!=="string" || !input[field].trim()) throw new AccessError(400,`Thiếu ${field}.`);
    if(typeof input.grade !== "number" || !Number.isInteger(input.grade) || input.grade<1 || input.grade>12) throw new AccessError(400,"Khối lớp không hợp lệ.");
    const arrays=["objectives","knowledgeUnits","keywords","activities","exercises"];
    if(arrays.some(k=>!Array.isArray(input[k]))) throw new AccessError(400,"Cấu trúc nội dung học liệu không hợp lệ.");
    // Only accept lesson metadata belonging to a saved curriculum; canonicalize it.
    const curriculums=await actor.db.collection("curriculums").get();
    let metadata: Record<string,unknown>|undefined;
    for(const doc of curriculums.docs) {
      const c=doc.data();
      if(Number(c.grade)!==input.grade || ![c.subjectCode,c.subjectName].some(s=>subjectKey(s)===subjectKey(input.subject))) continue;
      for(const chapter of c.chapters??[]) for(const lesson of chapter.lessons??[])
        if(lesson.lessonCode===code) metadata={lessonCode:code,lessonTitle:lesson.title,subject:c.subjectName,grade:c.grade,chapterTitle:chapter.title};
    }
    if(!metadata) throw new AccessError(400,"Bài học chưa có trong Curriculum đúng môn/khối. Hãy lưu cấu trúc SGK trước.");
    const content=Object.fromEntries(arrays.map(k=>[k,input[k]]));
    const ref=actor.db.collection("knowledge_repository").doc(code);
    await actor.db.runTransaction(async tx=>{
      const old=await tx.get(ref);
      tx.set(ref,{...metadata,...content,status:"published",createdAt:old.data()?.createdAt??FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
    });
    return res.status(200).json({success:true,lessonCode:code});
  } catch(error) { return apiFailure(res,error); }
}

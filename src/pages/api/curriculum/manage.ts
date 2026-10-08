import type { CurriculumChapter, CurriculumLesson } from "@/lib/education/curriculum";
import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { authenticate, requireAdmin, apiFailure, method, AccessError, objectBody, safeId } from "@/lib/server/educationAccess";
import { normalizeCurriculum, validateCurriculum, buildCurriculumId } from "@/lib/education/curriculum";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!method(req,res,["POST","PATCH","DELETE"])) return;
  try {
    const actor=await authenticate(req); requireAdmin(actor);
    const input=objectBody(req.body);
    const code=safeId(input.subjectCode,"Mã môn học");
    if (typeof input.grade !== "number" || !Number.isInteger(input.grade) || input.grade<1 || input.grade>12) throw new AccessError(400,"Khối lớp không hợp lệ.");
    const id=buildCurriculumId(code,input.grade), ref=actor.db.collection("curriculums").doc(id);
    if(req.method==="DELETE") { await ref.delete(); return res.status(200).json({success:true,id}); }
    if(req.method==="POST") {
      let data;
      try { data=normalizeCurriculum(input); }
      catch { throw new AccessError(400,"Cấu trúc Curriculum không hợp lệ."); }
      const errors=validateCurriculum(data);
      if (!["draft","reviewed","published"].includes(data.status)) errors.push("Trạng thái không hợp lệ.");
      if(errors.length) throw new AccessError(400,errors.join("\n"));
      // Serialize plain curriculum data before attaching SDK timestamp sentinels.
      // Do not traverse FieldValue/Timestamp instances with removeUndefinedDeep.
      const payload=JSON.parse(JSON.stringify(data));
      delete payload.createdAt; delete payload.updatedAt;
      await actor.db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        tx.set(ref,{...payload,id,createdAt:old.data()?.createdAt ?? FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
    } else {
      const lessonCode=safeId(input.lessonCode,"Mã bài học").toUpperCase();
      if (typeof input.status !== "string" || !["empty","imported","reviewed","published"].includes(input.status)) throw new AccessError(400,"Trạng thái bài học không hợp lệ.");
      await actor.db.runTransaction(async tx=>{
        const old=await tx.get(ref);
        if (!old.exists) throw new AccessError(404,"Không tìm thấy Curriculum.");
        let found=false;
        const chapters=(old.data()?.chapters ?? []).map((c:CurriculumChapter)=>({...c,lessons:(c.lessons??[]).map((l:CurriculumLesson)=>{
          if(l.lessonCode?.trim().toUpperCase()!==lessonCode) return l;
          found=true; return {...l,status:input.status};
        })}));
        if(!found) throw new AccessError(404,"Không tìm thấy bài trong Curriculum.");
        tx.update(ref,{chapters,updatedAt:FieldValue.serverTimestamp()});
      });
    }
    return res.status(200).json({success:true,id});
  } catch(error) { return apiFailure(res,error); }
}

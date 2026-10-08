import type { NextApiRequest, NextApiResponse } from "next";
import { authenticate, apiFailure, method, AccessError, inScope, fieldsDTO, safeId } from "@/lib/server/educationAccess";
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!method(req,res,["GET"])) return;
  try {
    const actor=await authenticate(req), code=safeId(req.query.lessonCode,"Mã bài học");
    const doc=await actor.db.collection("knowledge_repository").doc(code).get(), data=doc.data();
    if(!doc.exists || !data) return res.status(200).json({success:true,knowledge:null});
    if(actor.role==="teacher" && (data.status!=="published" || !inScope(actor,data.subject,data.grade)))
      throw new AccessError(403,"Học liệu chưa xuất bản hoặc nằm ngoài môn/khối được phân công.");
    const knowledge={...fieldsDTO(data,["lessonTitle","subject","grade","chapterTitle","objectives","knowledgeUnits","keywords","activities","exercises","status","createdAt","updatedAt"]),lessonCode:doc.id};
    return res.status(200).json({success:true,knowledge});
  } catch(error) { return apiFailure(res,error); }
}

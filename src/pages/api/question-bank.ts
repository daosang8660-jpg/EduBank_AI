import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { authenticate, apiFailure, method, AccessError, inScope, fieldsDTO, safeId, objectBody, subjectKey } from "@/lib/server/educationAccess";
import type { EducationActor } from "@/lib/server/educationAccess";
import { validateQuestion } from "@/lib/education/questionEdit";
import type { UpdateQuestionBankInput } from "@/services/questionBankManageService";

const fields=["subject","grade","chapterTitle","lessonCode","lessonTitle","type","level","question","options","correctAnswer","explanation","sourceKnowledgeIds","sourceType","status","createdBy","createdAt","updatedAt"];
const types=["multiple_choice","true_false","short_answer","essay"];
const levels=["recognition","understanding","application","high_application"];
const sources=["ai","teacher_upload","manual"];
function editable(actor:EducationActor,d:Record<string,unknown>):boolean {
  return actor.role==="admin" || (d.createdBy===actor.uid && inScope(actor,d.subject,d.grade));
}
function readable(actor:EducationActor,d:Record<string,unknown>):boolean {
  return actor.role==="admin" || (inScope(actor,d.subject,d.grade) && (d.status==="approved" || (d.status==="inactive" && d.createdBy===actor.uid)));
}
function dto(actor:EducationActor,id:string,d:Record<string,unknown>) { return {...fieldsDTO(d,fields),id,canEdit:editable(actor,d)}; }
export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  if(!method(req,res,["GET","PATCH"])) return;
  try {
    const actor=await authenticate(req), bank=actor.db.collection("question_bank");
    if(req.method==="GET") {
      if(req.query.id!==undefined) {
        const doc=await bank.doc(safeId(req.query.id)).get(),data=doc.data();
        if(!doc.exists || !data) return res.status(200).json({success:true,item:null});
        if(!readable(actor,data)) throw new AccessError(403,"Câu hỏi nằm ngoài phạm vi được phép sử dụng.");
        return res.status(200).json({success:true,item:dto(actor,doc.id,data)});
      }
      const filters:Record<string,string>={};
      for(const k of ["subject","grade","chapterTitle","lessonCode","type","level","sourceType","status","maxResults","cursor"]) {
        const v=req.query[k];
        if(v===undefined) continue;
        if(typeof v!=="string" || !v.trim() || v.length>300) throw new AccessError(400,"Bộ lọc câu hỏi không hợp lệ.");
        filters[k]=v.trim();
      }
      if(filters.grade && (!/^\d+$/.test(filters.grade) || Number(filters.grade)<1 || Number(filters.grade)>12)) throw new AccessError(400,"Khối lớp không hợp lệ.");
      if(filters.type && !types.includes(filters.type) || filters.level && !levels.includes(filters.level) ||
          filters.sourceType && !sources.includes(filters.sourceType) || filters.status && !["approved","inactive"].includes(filters.status))
        throw new AccessError(400,"Bộ lọc câu hỏi không hợp lệ.");
      const max=Number(filters.maxResults??300);
      if(!Number.isInteger(max) || max<1 || max>1000) throw new AccessError(400,"Giới hạn câu hỏi không hợp lệ.");
      let query=bank as FirebaseFirestore.Query;
      // A single equality filter avoids requiring new composite indexes.
      if(filters.lessonCode) query=query.where("lessonCode","==",filters.lessonCode);
      const snapshot=await query.get();
      const rows=snapshot.docs.filter(doc=>{
        const d=doc.data();
        if(!readable(actor,d) || d.status!==(filters.status??"approved")) return false;
        for(const k of ["subject","grade","chapterTitle","lessonCode","type","level","sourceType"]) {
          if(!filters[k]) continue;
          if(k==="subject" ? subjectKey(d[k])!==subjectKey(filters[k]) : k==="grade" ? Number(d[k])!==Number(filters[k]) : d[k]!==filters[k]) return false;
        }
        return !filters.cursor || doc.id>filters.cursor;
      }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
      const page=rows.slice(0,max), items=page.map(doc=>dto(actor,doc.id,doc.data()));
      return res.status(200).json({success:true,items,nextCursor:rows.length>max ? page[page.length-1].id : null});
    }
    const input=objectBody(req.body), id=safeId(input.id), ref=bank.doc(id);
    let patch:Record<string,unknown>;
    if(input.status!==undefined) {
      if(typeof input.status !== "string" || !["approved","inactive"].includes(input.status) || Object.keys(input).some(k=>!["id","status"].includes(k)))
        throw new AccessError(400,"Yêu cầu đổi trạng thái không hợp lệ.");
      patch={status:input.status};
    } else {
      if(typeof input.type !== "string" || typeof input.level !== "string" || (input.sourceType !== undefined && typeof input.sourceType !== "string") || !types.includes(input.type) || !levels.includes(input.level) || (input.sourceType!==undefined && !sources.includes(String(input.sourceType))))
        throw new AccessError(400,"Dạng, mức độ hoặc nguồn câu hỏi không hợp lệ.");
      for(const k of ["question","correctAnswer","explanation"]) if(typeof input[k]!=="string") throw new AccessError(400,"Nội dung câu hỏi không hợp lệ.");
      if(input.options!==undefined && (!Array.isArray(input.options) || input.options.some((v)=>typeof v!=="string"))) throw new AccessError(400,"Phương án không hợp lệ.");
      if(input.sourceKnowledgeIds!==undefined && (!Array.isArray(input.sourceKnowledgeIds) || input.sourceKnowledgeIds.some((v)=>typeof v!=="string"))) throw new AccessError(400,"Mã tri thức không hợp lệ.");
      try { validateQuestion(input as unknown as UpdateQuestionBankInput); }
      catch(error) { throw new AccessError(400,error instanceof Error?error.message:"Câu hỏi không hợp lệ."); }
      const validated = input as unknown as UpdateQuestionBankInput;
      const text=(v:string)=>v.replace(/\r\n?/g,"\n").replace(/[ \t]+/g," ").trim();
      if(validated.type==="multiple_choice" && new Set(validated.options.map(text)).size!==4) throw new AccessError(400,"Bốn phương án phải khác nhau.");
      patch={question:text(validated.question),type:validated.type,level:validated.level,options:validated.options?.map(text)??[],correctAnswer:text(validated.correctAnswer),explanation:text(validated.explanation),sourceKnowledgeIds:validated.sourceKnowledgeIds?.map(text).filter(Boolean)??[]};
      if(input.sourceType!==undefined) patch.sourceType=input.sourceType;
    }
    await actor.db.runTransaction(async tx=>{
      const old=await tx.get(ref),d=old.data();
      if(!old.exists || !d) throw new AccessError(404,"Không tìm thấy câu hỏi.");
      if(!editable(actor,d)) throw new AccessError(403,"Bạn chỉ được sửa câu hỏi do mình tạo, đúng môn/khối được phân công.");
      tx.update(ref,{...patch,updatedAt:FieldValue.serverTimestamp()});
    });
    return res.status(200).json({success:true,id,...(patch.status ? {status:patch.status} : {})});
  } catch(error) { return apiFailure(res,error); }
}

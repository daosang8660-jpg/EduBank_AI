import type { NextApiRequest, NextApiResponse } from "next";
import { FieldValue } from "firebase-admin/firestore";
import { authenticate, apiFailure, method, AccessError, inScope, fieldsDTO, safeId, objectBody } from "@/lib/server/educationAccess";
import { normalizeExam, validateExam } from "@/lib/education/exam";
import type { SaveExamInput } from "@/lib/education/exam";
const fields=["examName","examType","examSemester","subjectId","subjectName","gradeId","grade","lessonCodes","duration","totalScore","matrix","specification","specificationName","questions","examCodes","createdBy","status","createdAt","updatedAt"];
const types=["multiple_choice","true_false","short_answer","essay"], levels=["recognition","understanding","application","high_application"];
function prepare(raw:unknown):SaveExamInput {
  const data=objectBody(raw);
  for(const k of ["examName","subjectId","subjectName","gradeId"]) if(typeof data[k]!=="string") throw new AccessError(400,"Thiếu thông tin đề.");
  if(typeof data.examType !== "string" || (data.status !== undefined && typeof data.status !== "string") || (data.examSemester !== undefined && typeof data.examSemester !== "string") || !["15_minutes","midterm","final"].includes(data.examType) || !["draft","final"].includes(String(data.status??"draft")) || data.examSemester!==undefined && !["1","2"].includes(String(data.examSemester))) throw new AccessError(400,"Loại đề hoặc học kì không hợp lệ.");
  if(typeof data.grade !== "number" || !Number.isInteger(data.grade) || data.grade<1 || data.grade>12 || !Number.isFinite(data.totalScore)) throw new AccessError(400,"Khối lớp hoặc tổng điểm không hợp lệ.");
  if(!Array.isArray(data.lessonCodes) || data.lessonCodes.some((s)=>typeof s!=="string") || !Array.isArray(data.matrix) || !Array.isArray(data.questions) || data.questions.length>1000) throw new AccessError(400,"Ma trận, phạm vi hoặc câu hỏi không hợp lệ.");
  if(data.examCodes!==undefined && (!Array.isArray(data.examCodes) || data.examCodes.some((s)=>typeof s!=="string"))) throw new AccessError(400,"Mã đề không hợp lệ.");
  for(const cell of data.matrix) if(!cell || !types.includes(cell.type) || !levels.includes(cell.level) || !Number.isInteger(cell.count)) throw new AccessError(400,"Ô ma trận không hợp lệ.");
  for(const q of data.questions) {
    if(!q || !types.includes(q.type) || !levels.includes(q.level) || ["questionId","lessonCode","question","correctAnswer","explanation"].some(k=>typeof q[k]!=="string") || !Array.isArray(q.options) || q.options.some((o)=>typeof o!=="string") || !Array.isArray(q.markingGuide) || q.markingGuide.some((g)=>!g || typeof g.content!=="string" || !Number.isFinite(g.score) || g.score<0)) throw new AccessError(400,"Cấu trúc câu hỏi hoặc hướng dẫn chấm không hợp lệ.");
    if(!q.correctAnswer.trim() || !data.lessonCodes.includes(q.lessonCode)) throw new AccessError(400,"Đáp án hoặc phạm vi câu hỏi không hợp lệ.");
  }
  if(data.specification!==undefined) {
    if(!Array.isArray(data.specification) || data.specification.length>1000 || typeof data.specificationName!=="string") throw new AccessError(400,"Đặc tả ma trận không hợp lệ.");
    for(const row of data.specification) if(!row || typeof row.lessonCode!=="string" || !data.lessonCodes.includes(row.lessonCode) || !types.includes(row.type) || !levels.includes(row.level) || !Number.isInteger(row.count) || row.count<0 || !Number.isFinite(row.scorePerQuestion) || row.scorePerQuestion<0 || ["lessonTitle","requirement"].some(k=>row[k]!==undefined && typeof row[k]!=="string")) throw new AccessError(400,"Dòng đặc tả không hợp lệ.");
  }
  let input:SaveExamInput;
  try { validateExam(data as unknown as SaveExamInput); input=normalizeExam(data as unknown as SaveExamInput); }
  catch(error) { throw new AccessError(400,error instanceof Error?error.message:"Đề không hợp lệ."); }
  if(new Set(input.questions.map(q=>q.questionId)).size!==input.questions.length) throw new AccessError(400,"Đề có câu hỏi trùng ID.");
  if(new Set(input.matrix.map(c=>`${c.type}:${c.level}`)).size!==input.matrix.length) throw new AccessError(400,"Ma trận có ô trùng.");
  for(const cell of input.matrix) if(input.questions.filter(q=>q.type===cell.type && q.level===cell.level).length!==cell.count) throw new AccessError(400,"Số câu thực tế không khớp ma trận.");
  if(input.questions.some(q=>Math.abs(q.score-(input.matrix.find(c=>c.type===q.type&&c.level===q.level)?.scorePerQuestion??NaN))>0.001)) throw new AccessError(400,"Điểm câu hỏi không khớp ô ma trận.");
  if(input.matrix.reduce((n,c)=>n+c.count,0)!==input.questions.length || Math.abs(input.matrix.reduce((n,c)=>n+c.count*c.scorePerQuestion,0)-input.totalScore)>0.001) throw new AccessError(400,"Ma trận không khớp câu hỏi hoặc tổng điểm.");
  // Whitelist nested snapshots; clients cannot attach arbitrary student data.
  return {...fieldsDTO(input,["examName","examType","examSemester","subjectId","subjectName","gradeId","grade","lessonCodes","duration","totalScore","examCodes","status"]),
    ...(input.specification?{specificationName:input.specificationName??"",specification:input.specification.map(row=>fieldsDTO(row,["lessonCode","lessonTitle","requirement","type","level","count","scorePerQuestion"]))}:{}),
    matrix:input.matrix.map(c=>fieldsDTO(c,["type","level","count","scorePerQuestion"])),
    questions:input.questions.map(q=>({...fieldsDTO(q,["questionId","lessonCode","type","level","question","options","correctAnswer","explanation","score","order"]),markingGuide:q.markingGuide.map(g=>({content:g.content,score:g.score}))}))} as unknown as SaveExamInput;
}
export const config={api:{bodyParser:{sizeLimit:"2mb"}}};
export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  if(!method(req,res,["GET","POST","PATCH"])) return;
  try {
    const actor=await authenticate(req), collection=actor.db.collection("exams");
    const allowed=(d:Record<string,unknown>)=>actor.role==="admin" || d.createdBy===actor.uid && inScope(actor,d.subjectName,d.grade);
    const dto=(id:string,d:Record<string,unknown>)=>({...fieldsDTO(d,fields),id});
    if(req.method==="GET") {
      if(req.query.id!==undefined) {
        const doc=await collection.doc(safeId(req.query.id)).get(), d=doc.data();
        if(!doc.exists || !d) return res.status(200).json({success:true,exam:null});
        if(!allowed(d)) throw new AccessError(403,"Đề không thuộc phạm vi được phép truy cập.");
        return res.status(200).json({success:true,exam:dto(doc.id,d)});
      }
      const snapshot=await (actor.role==="teacher"?collection.where("createdBy","==",actor.uid):collection).get();
      const exams=snapshot.docs.filter(d=>allowed(d.data())).map(d=>dto(d.id,d.data()));
      return res.status(200).json({success:true,exams});
    }
    const body=objectBody(req.body);
    const ref=req.method==="PATCH" ? collection.doc(safeId(body.id)) : collection.doc();
    const data=body.status==="final" && req.method==="PATCH" ? undefined : prepare(body.input);
    if(data) {
      if(!inScope(actor,data.subjectName,data.grade)) throw new AccessError(403,"Đề nằm ngoài môn/khối được phân công.");
      if(actor.role==="teacher") {
        const curriculum=await actor.db.collection("curriculums").get();
        const valid=new Set<string>();
        for(const c of curriculum.docs) {
          const d=c.data();
          if(Number(d.grade)!==data.grade || !inScope(actor,d.subjectName,d.grade) || d.subjectName!==data.subjectName) continue;
          for(const chapter of d.chapters??[]) for(const lesson of chapter.lessons??[]) valid.add(lesson.lessonCode);
        }
        if(data.lessonCodes.some(c=>!valid.has(c))) throw new AccessError(403,"Phạm vi đề có bài chưa được phân công.");
      }
    }
    await actor.db.runTransaction(async tx=>{
      const old=await tx.get(ref), d=old.data();
      if(req.method==="PATCH") {
        if(!old.exists || !d) throw new AccessError(404,"Không tìm thấy đề.");
        if(!allowed(d)) throw new AccessError(403,"Bạn chỉ được sửa đề của mình.");
        if(d.status==="final" && data) throw new AccessError(409,"Đề đã chốt. Hãy dùng làm đề mới.");
      }
      if(data) tx.set(ref,{...data,id:ref.id,createdBy:d?.createdBy??actor.uid,createdAt:d?.createdAt??FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
      else tx.update(ref,{status:"final",updatedAt:FieldValue.serverTimestamp()});
    });
    return res.status(200).json({success:true,examId:ref.id});
  } catch(error) { return apiFailure(res,error); }
}

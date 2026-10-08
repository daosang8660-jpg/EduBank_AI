 import { knowledgeData } from "@/lib/knowledgeData";

export function getLessonByCode(code:string){

    return knowledgeData.find(
        lesson=>lesson.lessonCode===code
    );

}
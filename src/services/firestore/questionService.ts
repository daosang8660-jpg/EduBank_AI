import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  Timestamp
} from "firebase/firestore";

export async function saveQuestions<T extends object>(questions: readonly T[]) {

  const ids: string[] = [];

  for (const q of questions) {

    const doc = await addDoc(
      collection(db, "questions"),
      {
        ...q,
        createdAt: Timestamp.now()
      }
    );

    ids.push(doc.id);

  }

  return ids;

}
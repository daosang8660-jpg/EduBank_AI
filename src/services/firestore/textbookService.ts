import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

export type SelectItem = {
  id: string;
  name: string;
};

export async function getGrades(): Promise<SelectItem[]> {
  const q = query(
    collection(db, "grades"),
    orderBy("order")
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
  }));
}

export async function getSubjects(
  gradeId: string
): Promise<SelectItem[]> {

  const q = query(
    collection(db, "subjects"),
    where("gradeId", "==", gradeId),
    orderBy("name")
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name,
  }));
}

export async function getBooks(
  gradeId: string,
  subjectId: string
): Promise<SelectItem[]> {

  const q = query(
    collection(db, "books"),
    where("gradeId","==",gradeId),
    where("subjectId","==",subjectId),
    orderBy("name")
  );

  const snap = await getDocs(q);

  return snap.docs.map(doc=>({
      id:doc.id,
      name:doc.data().name,
  }));
}

export async function getChapters(
  bookId:string
):Promise<SelectItem[]>{

    const q=query(

        collection(db,"chapters"),

        where("bookId","==",bookId),

        orderBy("order")

    );

    const snap=await getDocs(q);

    return snap.docs.map(doc=>({

        id:doc.id,

        name:doc.data().name

    }));

}

export async function getLessons(
chapterId:string
):Promise<SelectItem[]>{

    const q=query(

        collection(db,"lessons"),

        where("chapterId","==",chapterId),

        orderBy("order")

    );

    const snap=await getDocs(q);

    return snap.docs.map(doc=>({

        id:doc.id,

        name:doc.data().name

    }));

}
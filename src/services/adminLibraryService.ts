import { collection, doc, documentId, getDoc, getDocsFromServer, limit, orderBy, query, startAfter } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type LibraryKind = "questions" | "exams";
export type LibraryItem = { id: string; data: Record<string, unknown> };
const PAGE_SIZE = 25;

// Firestore rules remain responsible for enforcing access. This extra check gives
// the admin UI a clear error and avoids requesting bank data as a teacher.
export async function loadAdminLibrary(kind: LibraryKind, afterId?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập lại.");
  await user.getIdToken();
  const profile = await getDoc(doc(db, "users", user.uid));
  const profileData = profile.data();
  if (!profile.exists() || profileData?.role !== "admin" || profileData.status !== "active") {
    throw new Error("Chỉ quản trị viên đang hoạt động được xem ngân hàng này.");
  }
  if (auth.currentUser?.uid !== user.uid) throw new Error("Phiên đăng nhập đã thay đổi.");
  const name = kind === "questions" ? "question_bank" : "exams";
  const base = collection(db, name);
  const request = afterId
    ? query(base, orderBy(documentId()), startAfter(afterId), limit(PAGE_SIZE + 1))
    : query(base, orderBy(documentId()), limit(PAGE_SIZE + 1));
  const snapshot = await getDocsFromServer(request);
  if (auth.currentUser?.uid !== user.uid) throw new Error("Phiên đăng nhập đã thay đổi.");
  const page = snapshot.docs.slice(0, PAGE_SIZE);
  return {
    items: page.map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> })),
    hasMore: snapshot.docs.length > PAGE_SIZE,
    lastId: page.length ? page[page.length - 1].id : undefined,
  };
}

export function displayText(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}
export function objectRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}
export function filterLibrary(items: LibraryItem[], search: string, subject: string, grade: string) {
  const needle = search.trim().toLocaleLowerCase("vi");
  return items.filter(({ data }) => {
    const name = displayText(data.subjectName) || displayText(data.subject) || displayText(data.subjectId);
    const content = [data.question, data.examName, data.lessonTitle, data.lessonCode, name, data.grade].map(displayText).join(" ").toLocaleLowerCase("vi");
    return (!subject || name === subject) && (!grade || displayText(data.grade) === grade) && content.includes(needle);
  });
}

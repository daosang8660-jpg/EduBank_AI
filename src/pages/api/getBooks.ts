import type { NextApiRequest, NextApiResponse } from "next";
import { getBooks } from "@/services/firestore/textbookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const grade = String(req.query.grade ?? "");
  const subject = String(req.query.subject ?? "");

  try {
    const data = await getBooks(grade, subject);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lấy được bộ sách." });
  }
}
import type { NextApiRequest, NextApiResponse } from "next";
import { getSubjects } from "@/services/firestore/textbookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const grade = String(req.query.grade ?? "");

  try {
    const data = await getSubjects(grade);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lấy được môn học." });
  }
}
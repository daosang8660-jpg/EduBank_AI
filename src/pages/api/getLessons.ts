import type { NextApiRequest, NextApiResponse } from "next";
import { getLessons } from "@/services/firestore/textbookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const chapter = String(req.query.chapter ?? "");

  try {
    const data = await getLessons(chapter);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lấy được bài học." });
  }
}
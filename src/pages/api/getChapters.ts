import type { NextApiRequest, NextApiResponse } from "next";
import { getChapters } from "@/services/firestore/textbookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const book = String(req.query.book ?? "");

  try {
    const data = await getChapters(book);
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lấy được chương." });
  }
}
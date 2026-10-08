import type { NextApiRequest, NextApiResponse } from "next";
import { getGrades } from "@/services/firestore/textbookService";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const data = await getGrades();
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Không lấy được danh sách lớp." });
  }
}
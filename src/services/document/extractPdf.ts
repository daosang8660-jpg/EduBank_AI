import fs from "fs";
import pdf from "pdf-parse";

export async function extractPdf(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);

    const data = await pdf(buffer);

    return data.text.trim();
  } catch (error) {
    console.error("Lỗi đọc PDF:", error);
    throw new Error("Không thể đọc nội dung PDF");
  }
}
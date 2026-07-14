import path from "path";

import { extractPdf } from "./extractPdf";
import { extractWord } from "./extractWord";
import { extractExcel } from "./extractExcel";
import { extractPpt } from "./extractPpt";
import { analyzeDocument } from "./analyzeDocument";

export async function extractDocument(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  let text = "";

  switch (ext) {
    case ".pdf":
      text = await extractPdf(filePath);
      break;

    case ".doc":
    case ".docx":
      text = await extractWord(filePath);
      break;

    case ".xls":
    case ".xlsx":
      text = await extractExcel(filePath);
      break;

    case ".ppt":
    case ".pptx":
      text = await extractPpt(filePath);
      break;

    default:
      throw new Error("Định dạng chưa được hỗ trợ");
  }

  return analyzeDocument(text);
}
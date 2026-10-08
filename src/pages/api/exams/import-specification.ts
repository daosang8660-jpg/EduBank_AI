import type { NextApiRequest, NextApiResponse } from "next";
import formidable, { type Fields, type Files } from "formidable";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { AccessError, authenticate, inScope, method, apiFailure } from "@/lib/server/educationAccess";
import { readPdfSpecification } from "@/lib/server/pdfExamSpecification";

export const config = { api: { bodyParser: false } };
export const maxDuration = 60;
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!method(req, res, ["POST"])) return;
  let tempDirectory: string | undefined;
  try {
    // Authenticate before accepting uploads or spending AI quota.
    const actor = await authenticate(req);
    if (!req.headers["content-type"]?.startsWith("multipart/form-data"))
      throw new AccessError(400, "Yêu cầu tải PDF không hợp lệ.");
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "edubank-matrix-"));
    let parsed: [Fields, Files];
    try {
      parsed = await formidable({ uploadDir: tempDirectory, maxFiles: 1,
        maxFileSize: MAX_BYTES, maxTotalFileSize: MAX_BYTES, maxFields: 2,
        maxFieldsSize: 2048, allowEmptyFiles: false }).parse(req);
    } catch { throw new AccessError(400, "Chỉ tải một PDF không rỗng, tối đa 3 MB."); }
    const [fields, files] = parsed;
    const subject = fields.subject?.length === 1 ? fields.subject[0].trim() : "";
    const grade = fields.grade?.length === 1 ? Number(fields.grade[0]) : NaN;
    if (!subject || subject.length > 100 || !Number.isInteger(grade) || grade < 6 || grade > 9)
      throw new AccessError(400, "Hãy chọn môn và khối từ 6 đến 9 trước khi nhập PDF.");
    if (!inScope(actor, subject, grade)) throw new AccessError(403, "Môn hoặc khối nằm ngoài phạm vi được phân công.");
    const uploaded = files.file?.length === 1 && Object.keys(files).length === 1 ? files.file[0] : null;
    if (!uploaded || !uploaded.originalFilename?.toLowerCase().endsWith(".pdf"))
      throw new AccessError(400, "Hãy chọn một tệp PDF ma trận/đặc tả.");
    const bytes = await fs.readFile(uploaded.filepath);
    if (bytes.length > MAX_BYTES || bytes.subarray(0, 5).toString("ascii") !== "%PDF-")
      throw new AccessError(400, "Nội dung tệp không phải PDF hợp lệ hoặc vượt quá 3 MB.");
    const result = await readPdfSpecification(bytes, subject, grade);
    return res.status(200).json({ success: true, ...result });
  } catch (error) { return apiFailure(res, error); }
  finally { if (tempDirectory) await fs.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined); }
}

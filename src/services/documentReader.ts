// src/services/documentReader.ts

export type SupportedDocumentType = "pdf" | "txt";

export interface DocumentReadResult {
  fileName: string;
  fileType: SupportedDocumentType;
  content: string;
  pageCount?: number;
  characterCount: number;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts.pop() ?? "";
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateFile(file: File): void {
  if (!file) {
    throw new Error("Chưa chọn tệp học liệu.");
  }

  if (file.size === 0) {
    throw new Error("Tệp học liệu đang trống.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Dung lượng tệp vượt quá giới hạn 20 MB.");
  }
}

async function readTextFile(file: File): Promise<DocumentReadResult> {
  const rawText = await file.text();
  const content = normalizeText(rawText);

  if (!content) {
    throw new Error("Không đọc được nội dung văn bản trong tệp.");
  }

  return {
    fileName: file.name,
    fileType: "txt",
    content,
    characterCount: content.length,
  };
}

async function readPdfFile(file: File): Promise<DocumentReadResult> {
  const pdfjs = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdfDocument = await loadingTask.promise;

  const pages: string[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdfDocument.numPages;
    pageNumber += 1
  ) {
    const page = await pdfDocument.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => {
        if ("str" in item) {
          return item.str;
        }

        return "";
      })
      .join(" ");

    const normalizedPageText = normalizeText(pageText);

    if (normalizedPageText) {
      pages.push(
        `--- Trang ${pageNumber} ---\n${normalizedPageText}`
      );
    }
  }

  const content = normalizeText(pages.join("\n\n"));

  if (!content) {
    throw new Error(
      "Không trích xuất được chữ từ PDF. Tệp có thể là ảnh scan và cần xử lý OCR."
    );
  }

  return {
    fileName: file.name,
    fileType: "pdf",
    content,
    pageCount: pdfDocument.numPages,
    characterCount: content.length,
  };
}

export async function readDocument(
  file: File
): Promise<DocumentReadResult> {
  validateFile(file);

  const extension = getFileExtension(file.name);

  switch (extension) {
    case "pdf":
      return readPdfFile(file);

    case "txt":
      return readTextFile(file);

    case "doc":
    case "docx":
      throw new Error(
        "Chức năng đọc Word chưa được cài đặt. Hiện hệ thống hỗ trợ PDF và TXT."
      );

    default:
      throw new Error(
        "Định dạng tệp không được hỗ trợ. Vui lòng chọn PDF hoặc TXT."
      );
  }
}
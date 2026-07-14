export interface DocumentAnalysis {
  subject?: string;
  grade?: string;
  lesson?: string;
  title?: string;
  keywords: string[];
  pages?: number;
  content: string;
}

export async function analyzeDocument(text: string): Promise<DocumentAnalysis> {
  // Tạm thời chỉ trả về dữ liệu cơ bản.
  // Sau này sẽ thay bằng Gemini.

  return {
    content: text,
    keywords: [],
  };
}
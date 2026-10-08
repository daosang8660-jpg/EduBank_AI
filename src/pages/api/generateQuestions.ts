import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Khởi tạo SDK với API Key từ biến môi trường
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // Nhận dữ liệu đầu vào từ client (từ file src/components/ai/AIGenerator.tsx chẳng hạn)
    const { subject, grade, lesson, questionCount } = req.body;

    // Sử dụng model Flash cho tốc độ sinh nhanh, và ÉP KIỂU trả về JSON
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json", // Bắt buộc AI trả về JSON hợp lệ
      }
    });

    // Prompt hướng dẫn AI (có thể tinh chỉnh thêm dựa vào schema ở src/models/Question.ts)
    const prompt = `
      Đóng vai một chuyên gia giáo dục. Hãy tạo ${questionCount || 4} câu hỏi trắc nghiệm cho:
      - Môn học: ${subject}
      - Khối lớp: ${grade}
      - Bài học cụ thể: ${lesson}
      
      Hãy phân bổ đều theo 4 mức độ nhận thức: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao.
      
      TRẢ VỀ MỘT MẢNG JSON VỚI CẤU TRÚC SAU CHO MỖI OBJECT:
      {
        "cognitive_level": "nhan_biet" | "thong_hieu" | "van_dung" | "van_dung_cao",
        "content": "Nội dung câu hỏi...",
        "options": {
          "A": "Lựa chọn A",
          "B": "Lựa chọn B",
          "C": "Lựa chọn C",
          "D": "Lựa chọn D"
        },
        "correct_answer": "A" | "B" | "C" | "D",
        "explanation": "Giải thích ngắn gọn tại sao đáp án này đúng."
      }
    `;

    // Gọi API
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse chuỗi JSON AI trả về thành mảng Object
    const generatedQuestions = JSON.parse(responseText);

    // Trả dữ liệu về cho Frontend
    return res.status(200).json({ success: true, data: generatedQuestions });

  } catch (error) {
    console.error("AI Generation Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Đã có lỗi xảy ra khi gọi AI sinh câu hỏi.' 
    });
  }
}
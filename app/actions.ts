'use server'
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Lỗi: Kiểm tra file .env.local nhé!";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Dùng model 2.5 Flash để ổn định nhất cho bản Free
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemInstruction = `Bạn là Sunna AI. Với mỗi bước học, hãy kèm theo link:
📺 Xem video: https://www.youtube.com/results?search_query=[từ khóa]
Trả lời bằng tiếng Việt, thân thiện.`;

    const result = await model.generateContent(systemInstruction + "\n\nYêu cầu: " + prompt);
    return result.response.text();
  } catch (error) {
    return "Lỗi kết nối rồi ông giáo ơi!";
  }
}
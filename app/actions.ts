'use server'
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGemini(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Lỗi: Kiểm tra file .env.local nhé!";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Dùng model 2.5 Flash để ổn định nhất cho bản Free
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemInstruction = `Bạn là Sunna AI - Chuyên gia tư vấn lộ trình học tập cá nhân hóa cho học sinh. 
Khi trả lời, bạn PHẢI tuân thủ cấu trúc sau:

## 🎯 Mục tiêu tổng quát
(Tóm tắt ngắn gọn những gì người dùng sẽ đạt được)

---

## 🚀 Lộ trình chi tiết (Roadmap)
### 🔹 Giai đoạn 1: Nền tảng (Cần nắm vững gì?)
* Ý 1...
* Ý 2... [📺 Xem video](link_youtube)

### 🔹 Giai đoạn 2: Tăng tốc (Luyện tập gì?)
* Ý 1...
* Ý 2... [📺 Xem video](link_youtube)

### 🔹 Giai đoạn 3: Về đích (Mẹo đạt điểm cao)
* Ý 1...

---

## 💡 Gợi ý thêm & Thảo luận
(Đưa ra 2-3 câu hỏi gợi mở để người dùng bổ sung ý tưởng hoặc đào sâu thêm vấn đề).

Phong cách: Thân thiện, sử dụng icon (✨, 📚, ✅). Nếu người dùng nhắn thêm ý, hãy cập nhật lộ trình dựa trên ý đó.`;

    const result = await model.generateContent(systemInstruction + "\n\nYêu cầu: " + prompt);
    return result.response.text();
  } catch (error) {
    return "Lỗi kết nối!";
  }
}
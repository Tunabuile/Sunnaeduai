'use server'
import { GoogleGenerativeAI } from "@google/generative-ai";

// Nhận vào mảng lịch sử thay vì 1 câu prompt để AI không bị "mất trí nhớ"
export async function askGemini(history: { role: string; content: string }[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Lỗi: Kiểm tra file .env.local nhé!";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Dùng model 2.5 Flash theo chuẩn ý ông giáo!
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: `Bạn là Sunna AI - Chuyên gia tư vấn lộ trình học tập cá nhân hóa, cũng như là hỗ trợ học tập cho học sinh.
      * PHẢI hỗ trợ song ngữ Việt - Anh. Nếu người dùng nhắn tiếng Anh, hãy trả lời bằng tiếng Anh.* 

Khi trả lời, bạn PHẢI tuân thủ cấu trúc sau:

## 🎯 Mục tiêu tổng quát
(Tóm tắt ngắn gọn những gì người dùng sẽ đạt được)

---

## 🚀 Lộ trình chi tiết (Roadmap)

### 🔹 Giai đoạn 1: Nền tảng (Cần nắm vững gì?)

* Ý 1...

* Ý 2... [📺 Xem video bài giảng](https://www.youtube.com/results?search_query=từ+khóa+bài+học)

### 🔹 Giai đoạn 2: Tăng tốc (Luyện tập gì?)

* Ý 1...

* Ý 2... [📺 Xem video bài giảng](https://www.youtube.com/results?search_query=từ+khóa+bài+học)

### 🔹 Giai đoạn 3: Về đích (Mẹo đạt điểm cao)

* Ý 1...

---

## 💡 Gợi ý thêm & Thảo luận
(Đưa ra 2-3 câu hỏi gợi mở để người dùng bổ sung ý tưởng hoặc đào sâu thêm vấn đề).

Phong cách: Thân thiện, sử dụng icon (✨, 📚, ✅). Nếu người dùng nhắn thêm ý, hãy cập nhật lộ trình dựa trên ý đó.` 
    });

    // Xử lý logic để AI nhớ tin nhắn cũ
    if (!history || history.length === 0) return "";
    const lastMessage = history[history.length - 1].content;
    const chatHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(lastMessage);
    
    return result.response.text();
  } catch (error) {
    return "Lỗi kết nối hoặc AI đang quá tải, ông giáo thử lại nhé!";
  }
}
'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Thêm tham số imageBase64 để AI có thể "nhìn" được ảnh ông gửi lên
export async function askGemini(history: { role: string; content: string }[], imageBase64?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Lỗi: Kiểm tra file .env.local nhé!";

  try {
    // Tui dùng bản 1.5 Flash vì nó xử lý ảnh và RAG cực mượt cho năm 2026
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash", 
      systemInstruction: `Bạn là Sunna AI - Chuyên gia tư vấn lộ trình học tập cá nhân hóa, cũng như là hỗ trợ học tập cho học sinh.
      * PHẢI hỗ trợ song ngữ Việt - Anh. Nếu người dùng nhắn tiếng Anh, hãy trả lời bằng tiếng Anh.* Khi trả lời, bạn PHẢI tuân thủ cấu trúc sau:

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

    if (!history || history.length === 0) return "";

    // Lấy tin nhắn cuối cùng của người dùng
    const lastMessage = history[history.length - 1].content;
    
    // Chuyển đổi lịch sử chat sang định dạng của Google SDK
    const chatHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Bắt đầu phiên chat có trí nhớ
    const chat = model.startChat({ history: chatHistory });

    if (imageBase64) {
      // Nếu có ảnh, mình gửi cả text và ảnh dưới dạng mảng parts
      const imageData = imageBase64.split(',')[1];
      const result = await chat.sendMessage([
        { text: lastMessage || "Hãy phân tích hình ảnh này và đưa ra lộ trình học tập phù hợp." },
        { inlineData: { data: imageData, mimeType: "image/png" } }
      ]);
      return result.response.text();
    } else {
      // Nếu không có ảnh, chỉ gửi text như bình thường
      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    }

  } catch (error) {
    console.error("Lỗi Gemini:", error);
    return "Lỗi kết nối hoặc AI đang quá tải, ông giáo thử lại nhé!";
  }
}
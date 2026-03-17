'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function askGemini(history: { role: string; content: string }[], imageBase64?: string) {
  // 1. Lấy và kiểm tra API Key ĐẦU TIÊN
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Lỗi: Không tìm thấy GEMINI_API_KEY. Hãy kiểm tra lại file .env.local nhé!";
  }

  try {
    // --- DEBUG LOGS ---
    console.log("📥 [Backend] Nhận được lịch sử:", JSON.stringify(history, null, 2));
    console.log("📥 [Backend] Có ảnh đính kèm không:", !!imageBase64);

    // 2. CHUYỂN VÀO ĐÂY: Chỉ khởi tạo khi chắc chắn đã có API Key
    const genAI = new GoogleGenerativeAI(apiKey);

    // 3. Sửa tên model thành gemini-1.5-flash (bản 2.5 flash sẽ gây lỗi vì chưa hỗ trợ API)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      systemInstruction: `Bạn là Sunna AI - Chuyên gia tư vấn học tập cá nhân hóa và gia sư hỗ trợ học sinh.
      * PHẢI hỗ trợ song ngữ Việt - Anh. 
      - Nếu người dùng hỏi bài tập cụ thể (như giải phương trình, toán lý hóa...): Hãy giải từng bước rõ ràng.
      - Nếu người dùng hỏi lộ trình học: Trình bày theo 3 giai đoạn (Nền tảng, Tăng tốc, Về đích).` 
    });

    if (!history || history.length === 0) {
      console.log("⚠️ [Backend] Lịch sử rỗng, không thể chat. Trả về rỗng.");
      return "";
    }

    const lastMessage = history[history.length - 1].content;
    console.log("💬 [Backend] Tin nhắn mới nhất cần xử lý:", lastMessage);
    
    const chatHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: chatHistory });

    if (imageBase64) {
      const imageData = imageBase64.split(',')[1];
      const result = await chat.sendMessage([
        { text: lastMessage || "Hãy phân tích hình ảnh này." },
        { inlineData: { data: imageData, mimeType: "image/png" } }
      ]);
      return result.response.text();
    } else {
      const result = await chat.sendMessage(lastMessage);
      return result.response.text();
    }

  } catch (error) {
    // In lỗi ra terminal VSCode để bạn dễ theo dõi
    console.error("Lỗi Gemini Backend:", error);
    return "Lỗi kết nối hoặc AI đang quá tải, ông giáo thử lại nhé!";
  }
}
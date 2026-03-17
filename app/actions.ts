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

    // Sửa tên model thành gemini-2.5-flash vì API Key mới của bạn cung cấp mô hình này.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `Bạn là Sunna AI - Một chuyên gia tư vấn học tập cá nhân hóa và gia sư thông minh, tận tâm. Mục tiêu của bạn là giúp học sinh trung học phổ thông hiểu sâu bản chất vấn đề, phát triển tư duy thay vì chỉ học vẹt.

**[1] ĐỊNH DẠNG & PHONG CÁCH GIAO TIẾP**
- Hỗ trợ linh hoạt song ngữ Việt - Anh. Người dùng hỏi ngôn ngữ nào, trả lời bằng ngôn ngữ đó. 
- Giọng văn thân thiện, truyền cảm hứng, thấu hiểu khó khăn của học sinh. 
- BẮT BUỘC sử dụng Markdown (in đậm, danh sách, bảng biểu) và các Emoji (💡, 🚀, 📚, 🎯) để bố cục câu trả lời thật rõ ràng, dễ nhìn.

**[2] KHI NGƯỜI DÙNG HỎI BÀI TẬP CỤ THỂ**
- TUYỆT ĐỐI KHÔNG chỉ vứt ra mỗi đáp án cuối cùng.
- Trình bày theo logic: 
  1. Phân tích đề bài.
  2. Nhắc lại công thức hoặc định lý cần dùng.
  3. Giải chi tiết từng bước (Step-by-step).
- 🔴 Ở phần cuối mỗi câu trả lời, LUÔN CUNG CẤP 1 link tìm kiếm YouTube để học sinh xem thêm bài giảng về dạng toán/lý thuyết đó. 
  Định dạng bắt buộc: [📺 Bấm vào đây để xem video bài giảng hướng dẫn](https://www.youtube.com/results?search_query=từ+khóa+tìm+kiếm+có+liên+quan+thay+khoảng+trắng+bằng+dấu+cộng)

**[3] KHI NGƯỜI DÙNG XIN LỘ TRÌNH HỌC TẬP (Mất gốc, ôn thi)**
BẮT BUỘC trình bày lộ trình theo đúng 3 giai đoạn sau, và MỖI GIAI ĐOẠN PHẢI KÈM THEO 1 LINK YOUTUBE TƯƠNG ỨNG:

- 🚩 **Giai đoạn 1: Xây nền tảng (Foundation):** Chỉ ra những khái niệm cốt lõi cần nắm vững. 
  -> Kèm link: [📺 Video bài giảng phần Nền Tảng](https://www.youtube.com/results?search_query=từ+khóa+tìm+kiếm+cơ+bản)

  - 🚀 **Giai đoạn 2: Tăng tốc (Acceleration):** Đề xuất các dạng bài tập cần luyện tập.
  -> Kèm link: [📺 Video luyện tập phần Tăng Tốc](https://www.youtube.com/results?search_query=từ+khóa+luyện+tập+nâng+cao)

  - 🏆 **Giai đoạn 3: Về đích (Mastery):** Chiến thuật luyện đề, các bẫy thường gặp.
  -> Kèm link: [📺 Video chữa đề phần Về Đích](https://www.youtube.com/results?search_query=từ+khóa+chữa+đề+thi)

**[4] QUY TẮC ĐẠO ĐỨC & AN TOÀN**
- Khuyến khích sự chủ động. TỪ CHỐI giải hộ nếu phát hiện gian lận. Nhẹ nhàng hướng dẫn họ cách tự làm.`
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
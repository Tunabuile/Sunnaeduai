import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

// Tăng timeout lên 60s cho Vercel Pro, hoặc dùng streaming để bypass giới hạn 10s
export const maxDuration = 60;

const SYSTEM_INSTRUCTION = `Bạn là Sunna AI - Một "Hệ sinh thái hỗ trợ học tập và định hướng tương lai" dành riêng cho học sinh Việt Nam. Bạn không chỉ là một chatbot, mà là một Chuyên gia tư vấn học tập cá nhân hóa, Gia sư học thuật và Chuyên gia hướng nghiệp (Career Coach).

**[I] TƯ DUY VÀ PHONG CÁCH CỐT LÕI**
- **Thông minh & Linh hoạt:** Có khả năng xử lý từ các câu hỏi xã hội thông thường cho đến các bài toán phức tạp.
- **Bám sát giáo dục Việt Nam:** TRỌNG TÂM bám sát chương trình phổ thông mới, tham khảo đặc biệt 3 bộ sách giáo khoa: "Cánh diều", "Kết nối tri thức với cuộc sống" và "Chân trời sáng tạo". Luôn linh hoạt theo bộ sách học sinh đang học.
- **Ngôn ngữ:** Sử dụng tiếng Việt tự nhiên, trẻ trung (hợp Gen Z) nhưng vẫn giữ được sự chuẩn mực trong học thuật. Hỗ trợ song ngữ Anh - Việt hoàn hảo.
- **Cấu trúc phản hồi:** Luôn sử dụng Markdown (In đậm, bảng biểu, danh sách, khối code) để nội dung cực kỳ dễ nhìn và chuyên nghiệp.
- **Trình bày toán học:** BẮT BUỘC sử dụng LaTeX cho tất cả các công thức toán, lý, hóa (Ví dụ: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).

**[II] CHẾ ĐỘ 1: CHUYÊN GIA GIẢI BÀI TẬP (ACADEMIC SOLVER)**
1. **Phân tích đề (Analysis):** Tóm tắt các giả thiết và yêu cầu của bài toán.
2. **Phương pháp & Ý tưởng:** Nêu ra định lý, công thức hoặc hướng tư duy cần dùng.
3. **Lời giải chi tiết (Step-by-step):** Trình bày từng bước một cách khoa học.
4. **Lưu ý & Bẫy (Tips & Traps):** Chỉ ra những lỗi sai học sinh thường mắc phải.
5. **Kết luận:** Trình bày đáp án cuối cùng một cách nổi bật.

**[III] CHẾ ĐỘ 2: THÁM TỬ BẮT LỖI & LUYỆN TẬP (DEBUG & DRILL)**
1. **Soát lỗi (Detection):** Chỉ ra chính xác dòng nào, bước nào bị sai.
2. **Giải thích lỗi:** Tại sao bước đó lại sai?
3. **Hướng dẫn sửa:** Gợi ý cách sửa lại mà không giải hộ ngay.
4. **Bài tập tương tự (Practice):** Tạo 2-3 bài tập cùng dạng để luyện tập.

**[IV] CHẾ ĐỘ 3: CHUYÊN GIA HƯỚNG NGHIỆP (CAREER COUNSELOR)**
1. **Phân tích thế mạnh:** Gợi ý các khối ngành phù hợp.
2. **Thông tin ngành nghề:** Cơ hội việc làm trong kỷ nguyên AI.
3. **Tư vấn trường đại học:** Các trường top tại Việt Nam và quốc tế.
4. **Lộ trình phát triển:** Kỹ năng mềm, ngoại ngữ, chứng chỉ cần thiết.

**[V] CHẾ ĐỘ 4: TƯ VẤN LỘ TRÌNH HỌC TẬP (STUDY ROADMAP)**
Trình bày theo cấu trúc 3 giai đoạn (🚩 Nền tảng, 🚀 Tăng tốc, 🏆 Về đích).
BẮT BUỘC cung cấp link YouTube tìm kiếm tương ứng cho mỗi giai đoạn.

**[VI] QUY TẮC PHẢN HỒI TỔNG QUÁT**
- Nếu người dùng hỏi các câu thông thường: Trả lời như một người bạn thông thái, dí dỏm.
- Nếu người dùng gửi ảnh bài tập: Phân tích ảnh và áp dụng Chế độ 1 hoặc Chế độ 2.
- Luôn kết thúc bằng một câu hỏi gợi mở hoặc lời chúc truyền động lực.`;

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response("Lỗi: Không tìm thấy GEMINI_API_KEY.", { status: 500 });
  }

  const { history, roomId, userId, imageBase64 } = await req.json();

  if (!history || history.length === 0) {
    return new Response("", { status: 200 });
  }

  const lastMessage = history[history.length - 1].content;
  const chatHistory = history.slice(0, -1).map((msg: { role: string; content: string }) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} } as any],
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const chat = model.startChat({ history: chatHistory });

  // Dùng ReadableStream để stream response về client
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullText = "";

      try {
        let result;
        if (imageBase64) {
          const imageData = imageBase64.split(",")[1];
          result = await chat.sendMessageStream([
            { text: lastMessage || "Hãy phân tích hình ảnh này." },
            { inlineData: { data: imageData, mimeType: "image/png" } },
          ]);
        } else {
          result = await chat.sendMessageStream(lastMessage);
        }

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullText += text;
            controller.enqueue(encoder.encode(text));
          }
        }

        // Lưu vào Supabase sau khi stream xong
        if (fullText && roomId) {
          await supabase.from("messages").insert([{
            room_id: roomId,
            user_id: userId || "system",
            role: "assistant",
            content: fullText,
          }]);
        }
      } catch (err) {
        console.error("Lỗi Gemini Stream:", err);
        controller.enqueue(encoder.encode("Lỗi kết nối hoặc AI đang quá tải, ông giáo thử lại nhé!"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

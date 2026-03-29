'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/lib/supabase";

export async function createRoom(name?: string, userId?: string) {
  const { data, error } = await supabase
    .from('rooms')
    .insert([{ name: name || "Phòng học mới", created_by: userId || null, is_private: true }])
    .select()
    .single();

  if (error) {
    console.error("Supabase Error (Create Room):", error);
    throw new Error(error.message || "Lỗi tạo phòng");
  }
  return data;
}

export async function deleteRoom(roomId: string) {
  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId);

  if (error) {
    console.error("Supabase Error (Delete Room):", error);
    throw new Error(error.message || "Lỗi xóa phòng");
  }
}

export async function renameRoom(roomId: string, newName: string) {
  const { data, error } = await supabase
    .from('rooms')
    .update({ name: newName })
    .eq('id', roomId)
    .select()
    .single();

  if (error) {
    console.error("Supabase Error (Rename Room):", error);
    throw new Error(error.message || "Lỗi đổi tên phòng");
  }
  return data;
}

export async function getMessages(roomId: string) {
  const { data: messages, error: selectError } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (selectError) {
    console.error("Supabase Error (Get Messages):", selectError);
    throw new Error(selectError.message || "Lỗi lấy tin nhắn");
  }
  return messages;
}

export async function saveMessage(roomId: string, userId: string, role: 'user' | 'assistant', content: string, imageUrl?: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      room_id: roomId,
      user_id: userId,
      role,
      content,
      image_url: imageUrl
    }])
    .select()
    .single();

  if (error) {
    console.error("Supabase Error (Save Message):", error);
    throw new Error(error.message || "Lỗi lưu tin nhắn");
  }
  return data;
}

export async function askGemini(history: { role: string; content: string }[], roomId?: string, userId?: string, imageBase64?: string) {
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

    // thêm model gemini 2.5 flash
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      tools: [
        {
          googleSearch: {},
        } as any,
      ],
      systemInstruction: `Bạn là Sunna AI - Một "Hệ sinh thái hỗ trợ học tập và định hướng tương lai" dành riêng cho học sinh Việt Nam. Bạn không chỉ là một chatbot, mà là một Chuyên gia tư vấn học tập cá nhân hóa, Gia sư học thuật và Chuyên gia hướng nghiệp (Career Coach).

**[I] TƯ DUY VÀ PHONG CÁCH CỐT LÕI**
- **Thông minh & Linh hoạt:** Có khả năng xử lý từ các câu hỏi xã hội thông thường cho đến các bài toán phức tạp.
- **Bám sát giáo dục Việt Nam:** TRỌNG TÂM bám sát chương trình phổ thông mới, tham khảo đặc biệt 3 bộ sách giáo khoa: "Cánh diều", "Kết nối tri thức với cuộc sống" và "Chân trời sáng tạo". Luôn linh hoạt theo bộ sách học sinh đang học.
- **Ngôn ngữ:** Sử dụng tiếng Việt tự nhiên, trẻ trung (hợp Gen Z) nhưng vẫn giữ được sự chuẩn mực trong học thuật. Hỗ trợ song ngữ Anh - Việt hoàn hảo.
- **Cấu trúc phản hồi:** Luôn sử dụng Markdown (In đậm, bảng biểu, danh sách, khối code) để nội dung cực kỳ dễ nhìn và chuyên nghiệp.
- **Trình bày toán học:** BẮT BUỘC sử dụng LaTeX cho tất cả các công thức toán, lý, hóa (Ví dụ: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$).

**[II] CHẾ ĐỘ 1: CHUYÊN GIA GIẢI BÀI TẬP (ACADEMIC SOLVER)**
*Chế độ này tập trung vào sự logic, chi tiết và KHÔNG kèm video để người dùng tập trung hoàn toàn vào kiến thức.*

1. **Phân tích đề (Analysis):** Tóm tắt các giả thiết và yêu cầu của bài toán.
2. **Phương pháp & Ý tưởng:** Nêu ra định lý, công thức hoặc hướng tư duy cần dùng.
3. **Lời giải chi tiết (Step-by-step):** Trình bày từng bước một cách khoa học. Mỗi bước phải giải thích tại sao lại làm như vậy.
4. **Lưu ý & Bẫy (Tips & Traps):** Chỉ ra những lỗi sai học sinh thường mắc phải ở dạng bài này.
5. **Kết luận:** Trình bày đáp án cuối cùng một cách nổi bật.

**[III] CHẾ ĐỘ 2: THÁM TỬ BẮT LỖI & LUYỆN TẬP (DEBUG & DRILL)**
*Khi người dùng gửi lời giải của họ hoặc nhờ kiểm tra.*

1. **Soát lỗi (Detection):** Đọc kỹ bài làm của người dùng, chỉ ra chính xác dòng nào, bước nào bị sai.
2. **Giải thích lỗi:** Tại sao bước đó lại sai? (Do nhầm công thức, tính toán sai hay sai tư duy?).
3. **Hướng dẫn sửa:** Gợi ý cách sửa lại cho đúng mà không cần giải hộ ngay lập tức (kích thích tư duy).
4. **Bài tập tương tự (Practice):** Sau khi sửa lỗi, TỰ ĐỘNG tạo ra 2-3 bài tập cùng dạng nhưng có thông số khác để người dùng luyện tập lại ngay lập tức.
   - Mức độ 1: Tương đương (Củng cố).
   - Mức độ 2: Nâng cao (Thử thách).

**[IV] CHẾ ĐỘ 3: CHUYÊN GIA HƯỚNG NGHIỆP (CAREER COUNSELOR)**
*Hỗ trợ học sinh định vị bản thân và chọn trường, chọn ngành.*

1. **Phân tích thế mạnh:** Dựa trên sở thích hoặc môn học yêu thích của người dùng để gợi ý các khối ngành phù hợp (STEM, Kinh tế, Nghệ thuật, Xã hội...).
2. **Thông tin ngành nghề:** Giải thích chi tiết một ngành học là làm gì, cơ hội việc làm trong tương lai ra sao (đặc biệt là trong kỷ nguyên AI).
3. **Tư vấn trường đại học:** Cung cấp thông tin về các trường top tại Việt Nam và quốc tế liên quan đến ngành đó.
4. **Lộ trình phát triển:** Cần học thêm kỹ năng mềm gì? Ngoại ngữ nào? Chứng chỉ gì (IELTS, SAT, MOS...)?
5. **Công cụ hỗ trợ:** Gợi ý các bài trắc nghiệm tính cách (MBTI, Holland) để người dùng tự tìm hiểu thêm.

**[V] CHẾ ĐỘ 4: TƯ VẤN LỘ TRÌNH HỌC TẬP (STUDY ROADMAP)**
*Dành cho việc ôn thi hoặc lấy lại gốc kiến thức.*

Trình bày theo cấu trúc 3 giai đoạn (🚩 Nền tảng, 🚀 Tăng tốc, 🏆 Về đích).
- Ở chế độ này, BẮT BUỘC cung cấp link YouTube tìm kiếm tương ứng cho mỗi giai đoạn.
- Định dạng link: [📺 Xem video hỗ trợ tại đây](https://www.youtube.com/results?search_query=tu+khoa+hoc+tap)

**[VI] CÔNG NGHỆ RAG & TÌM KIẾN THỨC CHUẨN**
*Hệ thống được trang bị Google Search Grounding để tra cứu Sách giáo khoa và tài liệu của Bộ GD&ĐT.*
- Khi nhận được câu hỏi về lý thuyết, định nghĩa, lịch sử, văn học hoặc kiến thức học thuật tổng quát, BẮT BUỘC sử dụng công cụ tìm kiếm trên Google.
- Tự động ưu tiên thêm các từ khóa như "sách giáo khoa", "giáo trình chuẩn", "site:hanhtrangso.nxbgd.vn", "site:sachmem.vn", hoặc "file PDF sách giáo khoa" vào truy vấn tìm kiếm ngầm để lấy dữ liệu bài học chính xác nhất.
- Sau khi tìm được dữ liệu, hãy đúc kết lại thành đoạn kiến thức dễ hiểu và bắt buộc **trích dẫn nguồn gốc/tài liệu tham chiếu** để đảm bảo tính minh bạch cho học sinh.

**[VII] QUY TẮC PHẢN HỒI TỔNG QUÁT**
- Nếu người dùng hỏi các câu thông thường (Chào hỏi, tâm sự, kiến thức xã hội): Trả lời như một người bạn thông thái, dí dỏm và đầy thấu hiểu.
- Nếu người dùng gửi ảnh bài tập: Phân tích ảnh và áp dụng Chế độ 1 hoặc Chế độ 2.
- Luôn kết thúc bằng một câu hỏi gợi mở hoặc một lời chúc truyền động lực (Ví dụ: "Ông giáo còn chỗ nào chưa rõ về bài này không?", "Cố gắng lên, cánh cửa Đại học đang chờ bạn!").

**[VIII] CẤU TRÚC PHẢN HỒI MẪU CHO BÀI TẬP VỀ NHÀ (BTVN)**
Khi được yêu cầu tạo BTVN, hãy trình bày dạng bảng:
| STT | Câu hỏi | Mức độ | Gợi ý/Công thức |
|:---:|:---|:---:|:---|
| 1 | ... | Nhận biết | ... |
| 2 | ... | Thông hiểu | ... |
| 3 | ... | Vận dụng | ... |
Sau đó có một phần "Đáp án ẩn" bằng cách dùng Markdown spoiler hoặc danh sách rút gọn.`
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
    let responseText = "";

    if (imageBase64) {
      const imageData = imageBase64.split(',')[1];
      const result = await chat.sendMessage([
        { text: lastMessage || "Hãy phân tích hình ảnh này." },
        { inlineData: { data: imageData, mimeType: "image/png" } }
      ]);
      responseText = result.response.text();
    } else {
      // 3. XỬ LÝ KHI CHỈ CÓ VĂN BẢN (KHÔNG CÓ ẢNH)
      const result = await chat.sendMessage(lastMessage);
      responseText = result.response.text();
    }

    // Nếu có Room ID, lưu câu trả lời của AI vào Database luôn
    if (responseText && roomId) {
      await saveMessage(roomId, userId || "system", 'assistant', responseText);
    }

    return responseText;

  } catch (error) {
    // In lỗi ra terminal VSCode để bạn dễ theo dõi
    console.error("Lỗi Gemini Backend:", error);
    return "Lỗi kết nối hoặc AI đang quá tải, ông giáo thử lại nhé!";
  }
}

export async function generateChatTitle(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "Cuộc trò chuyện mới";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
    const result = await model.generateContent(`Hãy tạo 1 tiêu đề thật ngắn gọn (tối đa 5-6 chữ) mang tính tóm tắt cho câu hỏi/yêu cầu sau. KHÔNG dùng dấu ngoặc kép, KHÔNG giải thích, CHỈ in ra tiêu đề: "${prompt}"`);
    return result.response.text().trim().replace(/['"]/g, '');
  } catch (error) {
    console.error("Lỗi tạo tiêu đề:", error);
    return prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
  }
}
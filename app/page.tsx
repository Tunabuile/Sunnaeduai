'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askGemini } from './actions';
import { ArrowUp, Image as ImageIcon, X } from 'lucide-react';

export default function Home() {
  // 1. Khai báo các State (Trạng thái)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 2. Khai báo các Ref (Tham chiếu)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 3. Tự động cuộn xuống khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 4. Hàm xử lý khi chọn ảnh
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // 5. Hàm gửi tin nhắn
  const handleSend = async () => {
    if (!input.trim() && !image) return;
    if (loading) return;

    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input; // Giữ lại input để gửi
    const currentImage = image; // Giữ lại ảnh để gửi
    
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      // Gửi lịch sử chat và ảnh cho Gemini
      const response = await askGemini(messages, currentImage || undefined);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error("Lỗi gửi tin nhắn:", error);
      setMessages((prev) => [...prev, { role: 'assistant', content: "Có lỗi xảy ra rồi ông giáo ơi, thử lại nhé!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fdfdfd] flex flex-col items-center p-4 md:p-10 font-sans">
      
      {/* LOGO */}
      <div className="flex flex-col items-center mb-6 transition-all duration-500 hover:scale-105">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
           <svg viewBox="0 0 24 24" className="w-10 h-10 text-orange-500 fill-current">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm0-9V3M12 21v-3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
           </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-[#2c3e50] tracking-tight">
          Sunna Edu <span className="text-orange-500">AI</span>
        </h1>
      </div>

      {/* KHU VỰC CHAT */}
      <div className="flex-1 w-full max-w-3xl overflow-y-auto px-2 space-y-6 custom-scrollbar mb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg italic">Chào ông giáo! Nay mình học gì nhỉ? 📚</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-[24px] p-5 shadow-sm border ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white rounded-tr-none border-blue-400' 
                : 'bg-white text-slate-700 rounded-tl-none border-orange-100'
            }`}>
              <h2 className="text-[10px] font-bold mb-1 uppercase tracking-widest opacity-70">
                {msg.role === 'user' ? '👤 BẠN' : '📋 SUNNA AI'}
              </h2>
              <div className="prose prose-slate max-w-none text-[16px] leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* KHUNG NHẬP LIỆU */}
      <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-100 p-3 flex flex-col gap-2">
        
        {/* Xem trước ảnh nếu có */}
        {image && (
          <div className="relative w-20 h-20 ml-4 mt-2">
            <img src={image} alt="preview" className="w-full h-full object-cover rounded-xl border border-orange-200" />
            <button 
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Nút chọn ảnh */}
          <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleImageChange} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-gray-400 hover:text-orange-500 transition-colors mb-1"
          >
            <ImageIcon size={24} />
          </button>

          {/* Ô nhập văn bản */}
          <textarea
            className="flex-1 text-lg text-gray-700 placeholder-gray-400 border-none focus:ring-0 outline-none resize-none bg-transparent py-3"
            placeholder="Chụp ảnh bài tập hoặc nhập câu hỏi..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          {/* Nút gửi mũi tên tròn */}
          <button 
            onClick={handleSend}
            disabled={loading || (!input.trim() && !image)}
            className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-all shadow-lg disabled:bg-gray-200 disabled:shadow-none mb-1 flex-shrink-0"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp size={24} strokeWidth={3} /> 
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
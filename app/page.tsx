'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
// 3 dòng này phải nằm ở đây nè ông giáo:
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askGemini } from './actions';
import { ArrowUp } from 'lucide-react';
import { ArrowUp, Image as ImageIcon, X } from 'lucide-react';

export default function Home() {
  // Thay vì 1 chuỗi result, mình dùng mảng messages để lưu lịch sử
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [image, setImage] = useState<string | null>(null); // State lưu ảnh Base64
const fileInputRef = useRef<HTMLInputElement>(null);    // Ref để kích hoạt nút chọn file

// Thêm hàm xử lý khi ông giáo chọn ảnh từ máy tính
const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống khi có tin nhắn mới
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
const handleSend = async () => {
  if (!input.trim() && !image) return;

  const userMsg = { role: 'user', content: input };
  setMessages((prev) => [...prev, userMsg]);
  setInput('');
  setLoading(true);

  try {
    // Gửi cả lịch sử tin nhắn và ảnh cho AI
    const response = await askGemini(messages, image || undefined);
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
  } catch (error) {
    console.error("Lỗi gửi tin nhắn:", error);
  } finally {
    setImage(null);
    setLoading(false);
  }
};
    
    const userMsg = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]); // Hiện tin nhắn của ông lên trước
    setInput('');
    setLoading(true);

    // Gửi cả lịch sử messages đi để AI "nhớ" bài
    const response = await askGemini(input); 
    
    setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#fdfdfd] flex flex-col items-center p-6 md:p-24 font-sans">
      
      {/* GIỮ NGUYÊN LOGO MẶT TRỜI CŨ */}
      <div className="flex flex-col items-center mb-10 transition-all duration-500 hover:rotate-12">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
           <svg viewBox="0 0 24 24" className="w-10 h-10 text-orange-500 fill-current">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm0-9V3M12 21v-3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
           </svg>
        </div>
        <h1 className="text-5xl font-extrabold text-[#2c3e50] tracking-tight">
          Sunna Edu <span className="text-orange-500">AI</span>
        </h1>
      </div>

 {/* KHU VỰC HIỂN THỊ CHAT */}
<div className="w-full max-w-2xl space-y-6 mb-8 overflow-y-auto max-h-[60vh] px-2">
  {messages.map((msg, index) => (
    <div 
      key={index} 
      className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] bg-white rounded-[32px] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100 ${
        msg.role === 'user' 
          ? 'border-r-[6px] border-r-blue-500' // Bên phải cho Bạn
          : 'border-l-[6px] border-l-orange-500' // Bên trái cho AI
      }`}>
        <h2 className={`text-sm font-bold mb-2 ${msg.role === 'user' ? 'text-blue-600' : 'text-orange-600'}`}>
          {msg.role === 'user' ? '👤 Bạn:' : '📋 Sunna AI:'}
        </h2>
        <div className="prose prose-slate max-w-none text-[16px]">
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  ))}
  <div ref={messagesEndRef} />
</div>

      {/* GIỮ NGUYÊN KHUNG NHẬP LIỆU ĐỔ BÓNG MỊN */}
      <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border p-4 flex items-end gap-2">
        <textarea
          className="w-full text-xl text-gray-700 placeholder-gray-400 border-none focus:ring-0 outline-none resize-none bg-transparent"
          placeholder="Bạn đang gặp khó khăn gì?..."
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
        />
        
        <button 
  onClick={handleSend}
  disabled={loading || (!input.trim() && !image)}
  className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-all disabled:bg-gray-200"
>
  {loading ? (
    // Vòng xoay khi đang load
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  ) : (
    // Cái mũi tên nằm ở đây nè!
    <ArrowUp size={24} strokeWidth={3} /> 
  )}
</button>
      </div>
    </main>
  );
}
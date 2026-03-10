'use client';

import { useState, useEffect, useRef } from 'react';
import { askGemini } from './actions';
import ReactMarkdown from 'react-markdown';

export default function Home() {
  // Thay vì 1 chuỗi result, mình dùng mảng messages để lưu lịch sử
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
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
    if (!input.trim()) return;
    
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

      {/* KHU VỰC CHAT (Kéo lên xem tin nhắn cũ ở đây) */}
      <div className="w-full max-w-2xl space-y-6 mb-8 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`w-full bg-white rounded-[32px] p-6 border-l-[6px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] animate-in fade-in slide-in-from-bottom-2 duration-500 ${
              msg.role === 'user' ? 'border-blue-400' : 'border-orange-500'
            }`}
          >
            <h2 className={`text-lg font-bold mb-3 flex items-center gap-2 ${
              msg.role === 'user' ? 'text-blue-600' : 'text-orange-600'
            }`}>
               <span>{msg.role === 'user' ? '👤 Bạn:' : '📋 Lộ trình của bạn:'}</span>
            </h2>
            
            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-[16px]">
              <ReactMarkdown 
                components={{
                  a: ({node, ...props}) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold hover:text-blue-800 transition-colors" />
                  ),
                  strong: ({node, ...props}) => <strong {...props} className="text-slate-900 font-bold" />
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {/* Điểm neo để tự động cuộn xuống */}
        <div ref={messagesEndRef} />
      </div>

      {/* GIỮ NGUYÊN KHUNG NHẬP LIỆU ĐỔ BÓNG MỊN */}
      <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100 p-8 sticky bottom-10">
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
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : 'Thiết kế lộ trình ngay ✨'}
        </button>
      </div>
    </main>
  );
}
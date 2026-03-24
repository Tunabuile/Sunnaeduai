'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { askGemini, generateChatTitle } from './actions';
import { ArrowUp, Image as ImageIcon, X, Plus, MessageSquare, User, Menu, Trash2 } from 'lucide-react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';

interface Message {
  role: string;
  content: string;
  image?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export default function Home() {
  const { isSignedIn } = useAuth();
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [image, setImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khôi phục dữ liệu từ LocalStorage khi khởi chạy
  useEffect(() => {
    const savedChats = localStorage.getItem('sunna_chats');
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        setChatHistory(parsed);
      } catch (e) {
        console.error("Lỗi khi đọc lịch sử chat:", e);
      }
    }
  }, []);

  // Cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Tạo cuộc trò chuyện mới
  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setImage(null);
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // Xem lại cuộc trò chuyện cũ
  const handleSelectChat = (id: string) => {
    const chat = chatHistory.find(c => c.id === id);
    if (chat) {
      setActiveChatId(chat.id);
      setMessages(chat.messages);
    }
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // Xóa một cuộc trò chuyện
  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updatedChats = chatHistory.filter(c => c.id !== id);
    setChatHistory(updatedChats);
    localStorage.setItem('sunna_chats', JSON.stringify(updatedChats)); // Lưu ngay lập tức để tránh lỗi đồng bộ
    
    if (activeChatId === id) {
      handleNewChat();
    }
  };

  // Xử lý gửi tin nhắn
  const handleSend = async () => {
    if (!input.trim() && !image) return;
    if (loading) return;

    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    
    const currentInput = input;
    const currentImage = image;
    
    setInput('');
    setImage(null);
    setLoading(true);

    const now = Date.now();
    let currentSessionId = activeChatId;

    // --- LƯU LỊCH SỬ NGAY LẬP TỨC CHO TIN NHẮN CỦA BẠN ---
    const isNewChat = !currentSessionId;
    if (isNewChat) {
      currentSessionId = now.toString();
      setActiveChatId(currentSessionId);
    }

    setChatHistory(prev => {
      let newHistory = [...prev];
      const index = newHistory.findIndex(c => c.id === currentSessionId);
      
      if (index === -1) {
        // Tạo session mới
        newHistory.unshift({
          id: currentSessionId as string,
          title: currentInput.slice(0, 30) + (currentInput.length > 30 ? '...' : '') || 'Cuộc trò chuyện mới',
          messages: newMessages,
          updatedAt: now
        });
      } else {
        // Cập nhật session hiện tại
        newHistory[index] = { ...newHistory[index], messages: newMessages, updatedAt: now };
        // Đẩy lên đầu danh sách nếu chưa ở đầu
        if (index !== 0) {
          const [item] = newHistory.splice(index, 1);
          newHistory.unshift(item);
        }
      }
      
      localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
      return newHistory;
    });

    // --- TỰ ĐỘNG TẠO TIÊU ĐỀ NẾU LÀ CHAT MỚI ---
    if (isNewChat) {
      generateChatTitle(currentInput).then(title => {
        setChatHistory(prev => {
          let newHistory = [...prev];
          const idx = newHistory.findIndex(c => c.id === currentSessionId);
          if (idx !== -1 && title) {
            newHistory[idx] = { ...newHistory[idx], title };
            localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
          }
          return newHistory;
        });
      }).catch(e => console.error("Lỗi tự động tạo tiêu đề:", e));
    }

    try {
      // Gọi API AI
      const response = await askGemini(newMessages.map(m => ({role: m.role, content: m.content})), currentImage || undefined);
      
      const assistantMsg: Message = { role: 'assistant', content: response };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);

      // --- CẬP NHẬT LỊCH SỬ KHI AI TRẢ LỜI ---
      const timeAfterResponse = Date.now();
      setChatHistory(prev => {
        let newHistory = [...prev];
        const idx = newHistory.findIndex(c => c.id === currentSessionId);
        if (idx !== -1) {
          newHistory[idx] = { ...newHistory[idx], messages: finalMessages, updatedAt: timeAfterResponse };
          if (idx !== 0) {
            const [item] = newHistory.splice(idx, 1);
            newHistory.unshift(item);
          }
        }
        localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
        return newHistory;
      });

    } catch (error) {
      console.error("Lỗi khi gọi API:", error);
      const errorMsg: Message = { role: 'assistant', content: "Có lỗi xảy ra rồi ông giáo ơi, thử lại nhé!" };
      const failedMessages = [...newMessages, errorMsg];
      setMessages(failedMessages);
      
      // --- LƯU LẠI LƯỢT TRẢ LỜI LỖI ĐỂ TRÁNH MẤT LUỒNG DỮ LIỆU ---
      setChatHistory(prev => {
        let newHistory = [...prev];
        const idx = newHistory.findIndex(c => c.id === currentSessionId);
        if (idx !== -1) {
          newHistory[idx] = { ...newHistory[idx], messages: failedMessages, updatedAt: Date.now() };
        }
        localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
        return newHistory;
      });
    } finally {
      setLoading(false);
    }
  };

  // Phân nhóm Sidebar Chat
  const today = new Date().setHours(0, 0, 0, 0);
  const todayChats = chatHistory.filter(c => c.updatedAt >= today);
  const olderChats = chatHistory.filter(c => c.updatedAt < today);

  return (
    <div className="flex h-screen bg-[#fdfdfd] font-sans overflow-hidden">
      
      {/* Nền mờ cho danh mục trên Mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/5 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Lịch sử trò chuyện */}
      <aside className={`
        fixed md:relative z-30
        w-72 h-full border-r border-gray-100 bg-white flex flex-col shadow-[2px_0_10px_rgba(0,0,0,0.02)]
        transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-100 pt-6">
          <button 
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-4 py-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all font-semibold shadow-sm"
          >
            <Plus size={20} strokeWidth={2.5} />
            Đoạn chat mới
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-20">
          
          {todayChats.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
                Hôm nay
              </div>
              <div className="space-y-1">
                {todayChats.map(chat => (
                  <div key={chat.id} className="relative group">
                    <button 
                      onClick={() => handleSelectChat(chat.id)}
                      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left border ${
                        activeChatId === chat.id 
                          ? 'bg-orange-50/50 text-orange-800 border-orange-100/50' 
                          : 'text-gray-600 hover:bg-gray-50 border-transparent'
                      }`}
                    >
                      <MessageSquare size={18} className={activeChatId === chat.id ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500 transition-colors'} />
                      <span className="truncate flex-1 text-sm font-medium pr-6">{chat.title}</span>
                    </button>
                    {/* Nút xóa thùng rác */}
                    <button 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white md:bg-transparent rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {olderChats.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2 mt-4">
                Cũ hơn
              </div>
              <div className="space-y-1">
                {olderChats.map(chat => (
                  <div key={chat.id} className="relative group">
                    <button 
                      onClick={() => handleSelectChat(chat.id)}
                      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left border ${
                        activeChatId === chat.id 
                          ? 'bg-orange-50/50 text-orange-800 border-orange-100/50' 
                          : 'text-gray-600 hover:bg-gray-50 border-transparent'
                      }`}
                    >
                      <MessageSquare size={18} className={activeChatId === chat.id ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500 transition-colors'} />
                      <span className="truncate flex-1 text-sm font-medium pr-6">{chat.title}</span>
                    </button>
                    {/* Nút xóa thùng rác */}
                    <button 
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white md:bg-transparent rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {chatHistory.length === 0 && (
            <p className="text-center text-gray-400 text-sm italic mt-10">Chưa có lịch sử trò chuyện</p>
          )}

        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col relative h-full">
        
        {/* Nút Hamburger cho Mobile */}
        <div className="md:hidden absolute top-4 left-4 z-10">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-600 hover:text-orange-500 bg-white rounded-lg shadow-sm border border-gray-100"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Header & Đăng nhập (Top Right) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-8 z-10 flex gap-2">
          {!isSignedIn ? (
            <SignInButton mode="modal" signUpFallbackRedirectUrl="/" fallbackRedirectUrl="/">
              <button className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-5 py-2.5 rounded-full font-medium hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm">
                <User size={18} />
                <span className="hidden sm:inline">Đăng nhập</span>
              </button>
            </SignInButton>
          ) : (
            <UserButton />
          )}
        </div>

        {/* Nội dung trung tâm */}
        <div className="flex-1 flex flex-col items-center p-4 md:p-10 w-full overflow-hidden">
          
          {/* LOGO */}
          <div className="flex flex-col items-center mb-6 transition-all duration-500 hover:scale-105 mt-8 md:mt-2">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-3 shadow-inner">
               <svg viewBox="0 0 24 24" className="w-10 h-10 text-orange-500 fill-current">
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm0-9V3M12 21v-3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M3 12h3M18 12h3M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
               </svg>
            </div>
            <h1 className="text-4xl font-extrabold text-[#2c3e50] tracking-tight text-center">
              Sunna Edu <span className="text-orange-500">AI</span>
            </h1>
          </div>

          {/* KHU VỰC CHAT */}
          <div className="flex-1 w-full max-w-3xl overflow-y-auto px-2 space-y-6 custom-scrollbar mb-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 mt-20 transform transition-all hover:scale-105">
                <p className="text-xl font-medium text-slate-500">Hôm nay Sunna có thể giúp gì cho bạn?</p>
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
          <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-[0_10px_40px_rgba(0,0,0,0.06)] border border-gray-100 p-3 flex flex-col gap-2 relative z-0">
            
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
              <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleImageChange} />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-orange-500 transition-colors mb-1"
              >
                <ImageIcon size={24} />
              </button>

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
        </div>
      </main>
    </div>
  );
}
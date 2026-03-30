'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { generateChatTitle, saveMessage, getMessages, createRoom, renameRoom, deleteRoom } from './actions';
import { ArrowUp, Image as ImageIcon, X, Plus, MessageSquare, User, Menu, Trash2, Users, Edit2, Lock } from 'lucide-react';
import { useAuth, SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

function ChatContent() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const roomId = searchParams.get('room');

  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [image, setImage] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [roomList, setRoomList] = useState<any[]>([]);
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [joinId, setJoinId] = useState('');
  
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState('');

  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Khôi phục dữ liệu từ LocalStorage khi khởi chạy (cho chat cá nhân)
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

  // Sync tin nhắn từ Supabase khi vào phòng (cho chat nhóm)
  useEffect(() => {
    if (roomId) {
      getMessages(roomId).then(msgs => {
        if (msgs) {
          setMessages(msgs.map((m: any) => ({ 
            role: m.role, 
            content: m.content, 
            image: m.image_url 
          })));
        }
      }).catch(err => console.error("Lỗi lấy tin nhắn Supabase:", err));

      // Đăng ký Realtime lắng nghe tin nhắn mới
      const channel = supabase
        .channel(`room-${roomId}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, (payload) => {
          const newMsg = payload.new as any;
          // Chỉ thêm nếu tin nhắn đó chưa có trong list (tránh trùng do vừa gửi xong)
          setMessages(prev => {
            const isDuplicate = prev.some(m => m.content === newMsg.content && m.role === newMsg.role);
            if (isDuplicate) return prev;
            return [...prev, { role: newMsg.role, content: newMsg.content, image: newMsg.image_url }];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [roomId]);

  // Lấy danh sách phòng từ Supabase (ví dụ lấy 10 phòng gần nhất)
  useEffect(() => {
    supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => {
        if (data) setRoomList(data);
      });
  }, [roomId]);

  // Cuộn xuống tin nhắn mới nhất - chỉ khi user chưa scroll lên
  const scrollToBottom = (force = false) => {
    if (!force && userScrolledUp.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Chỉ scroll khi chọn chat cũ hoặc vào phòng mới, không scroll theo stream
  useEffect(() => {
    userScrolledUp.current = false;
    scrollToBottom(true);
  }, [activeChatId, roomId]);

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

  // Xem lại cuộc trò chuyện cũ (Local)
  const handleSelectChat = (id: string) => {
    router.push('/'); // Thoát khỏi room nếu đang ở room
    const chat = chatHistory.find(c => c.id === id);
    if (chat) {
      setActiveChatId(chat.id);
      setMessages(chat.messages);
    }
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // Tạo phòng học chung mới (Supabase)
  const handleCreateSharedRoom = async () => {
    try {
      setLoading(true);
      const room = await createRoom("Phòng học của " + (user?.firstName || "tôi"), user?.id);
      router.push(`/?room=${room.id}`);
      if(window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (error) {
      console.error("Lỗi tạo phòng:", error);
      alert("Không tạo được phòng chung rồi ông giáo ạ!");
    } finally {
      setLoading(false);
    }
  };

  // Xử lý nút tham gia phòng bằng ID
  const handleJoinById = () => {
    if (!joinId.trim()) return;
    router.push(`/?room=${joinId.trim()}`);
    setJoinId('');
    setShowJoinOptions(false);
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSelectRoom = (id: string) => {
    if (editingRoomId === id) return;
    router.push(`/?room=${id}`);
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteRoom = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Xóa phòng này? Toàn bộ tin nhắn sẽ mất.")) return;
    try {
      await deleteRoom(id);
      setRoomList(prev => prev.filter(r => r.id !== id));
      if (roomId === id) router.push('/');
    } catch (err) {
      console.error("Lỗi xóa phòng:", err);
    }
  };

  const startRenameRoom = (e: React.MouseEvent, id: string, currentName: string) => {
    e.stopPropagation();
    setEditingRoomId(id);
    setEditingRoomName(currentName);
  };

  const saveRenameRoom = async () => {
    if (!editingRoomId) return;
    const newName = editingRoomName.trim();
    const currentName = roomList.find(r => r.id === editingRoomId)?.name || "";
    
    if (newName && newName !== currentName) {
      try {
        await renameRoom(editingRoomId, newName);
        setRoomList(prev => prev.map(r => r.id === editingRoomId ? { ...r, name: newName } : r));
      } catch (err) {
        console.error("Lỗi đổi tên phòng:", err);
      }
    }
    setEditingRoomId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRenameRoom();
    } else if (e.key === 'Escape') {
      setEditingRoomId(null);
    }
  };

  // Xóa một cuộc trò chuyện
  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const isConfirm = window.confirm("Bạn có chắc chắn muốn xóa hội thoại này không?");
    if (isConfirm) {
      setChatHistory(prev => {
        const newHistory = prev.filter(c => c.id !== id);
        localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
        return newHistory;
      });
      if (activeChatId === id) {
        setMessages([]);
        setActiveChatId(null);
        router.push('/'); // Thoát khỏi room nếu đang ở room
      }
    }
  };

  // --- HÀM XỬ LÝ ĐỔI TÊN CHAT RIÊNG ---
  const startRenameChat = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingChatId(id);
    setEditingChatTitle(currentTitle);
  };

  const saveRenameChat = () => {
    if (!editingChatId) return;
    const newTitle = editingChatTitle.trim();
    if (newTitle) {
      setChatHistory(prev => {
        const newHistory = prev.map(c => c.id === editingChatId ? { ...c, title: newTitle } : c);
        localStorage.setItem('sunna_chats', JSON.stringify(newHistory));
        return newHistory;
      });
    }
    setEditingChatId(null);
  };

  const handleRenameChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRenameChat();
    } else if (e.key === 'Escape') {
      setEditingChatId(null);
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
    userScrolledUp.current = false;
    // Force scroll xuống khi user gửi tin
    setTimeout(() => scrollToBottom(true), 50);

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

    // --- TỰ ĐỘNG TẠO TIÊU ĐỀ NẾU LÀ CHAT MỚI (Local) ---
    if (isNewChat && !roomId) {
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

    // --- LƯU LÊN SUPABASE NẾU ĐANG Ở TRONG PHÒNG ---
    if (roomId) {
      try {
        await saveMessage(roomId, user?.id || 'anonymous', 'user', currentInput, currentImage || undefined);
      } catch (err) {
        console.error("Lỗi lưu tin nhắn lên Supabase:", err);
      }
    }

    try {
      // Gọi streaming API thay vì server action để tránh timeout Vercel
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: newMessages.map(m => ({ role: m.role, content: m.content })),
          roomId: roomId || null,
          userId: user?.id || null,
          imageBase64: currentImage || null,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Lỗi kết nối API');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      // Thêm tin nhắn AI rỗng trước, rồi cập nhật dần theo stream
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });
      }

      const finalMessages = [...newMessages, { role: 'assistant', content: fullText || "Ông giáo ơi, tui bị lỗi chút xíu, thử lại nhé!" }];

      // --- CẬP NHẬT LỊCH SỬ KHI AI TRẢ LỜI (Local) ---
      if (!roomId) {
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
      }

    } catch (error) {
      console.error("Lỗi khi gọi API:", error);
      const errorMsg: Message = { role: 'assistant', content: "Có lỗi xảy ra rồi ông giáo ơi, thử lại nhé!" };
      const failedMessages = [...newMessages, errorMsg];
      setMessages(failedMessages);
      
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
        <div className="p-4 border-b border-gray-100 pt-6 space-y-2">
          <button 
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-4 py-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all font-semibold shadow-sm text-sm"
          >
            <Plus size={18} />
            Chat riêng mới
          </button>
          
          <button 
            onClick={() => setShowJoinOptions(!showJoinOptions)}
            className="flex items-center gap-2 w-full px-4 py-3 bg-orange-50 text-orange-600 rounded-xl hover:bg-orange-100 transition-all font-semibold shadow-sm text-sm"
          >
            <Users size={18} />
            Tham gia phòng học chung
          </button>

          {/* Khung tuỳ chọn tham gia / tạo phòng */}
          {showJoinOptions && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3 mt-2 shadow-inner">
              <button 
                onClick={handleCreateSharedRoom}
                className="w-full px-3 py-2 bg-white text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors text-sm font-medium shadow-sm"
              >
                + Tạo phòng học mới
              </button>
              
              <div className="relative flex items-center">
                <div className="absolute inset-y-0 left-0 flex items-center mx-3 pointer-events-none">
                  <span className="text-gray-400 text-xs">ID</span>
                </div>
                <input 
                  type="text" 
                  placeholder="Nhập mã phòng (ID)..." 
                  className="w-full text-sm pl-8 pr-16 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinById();
                  }}
                />
                <button 
                  onClick={handleJoinById}
                  disabled={!joinId.trim()}
                  className="absolute right-1 px-3 py-1 bg-orange-500 text-white text-xs rounded-md hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  Vào
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar pb-20">
          
          {roomId && (
            <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 animate-pulse">
               <p className="text-xs font-bold text-orange-600 mb-1">🔴 ĐANG TRONG PHÒNG CHUNG</p>
               <p className="text-[10px] text-gray-500 truncate">ID: {roomId}</p>
            </div>
          )}

          {roomList.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
                Phòng học chung
              </div>
              <div className="space-y-1 mb-6">
                {roomList.map(room => (
                  <div key={room.id} className="relative group">
                    {editingRoomId === room.id ? (
                      <div className="flex items-center gap-2 w-full p-2 rounded-xl border border-orange-300 bg-orange-50 shadow-sm">
                        <Users size={16} className="text-orange-500 flex-shrink-0 ml-1" />
                        <input
                          type="text"
                          className="flex-1 text-xs font-medium bg-white border border-orange-200 outline-none rounded p-1 text-gray-800"
                          value={editingRoomName}
                          onChange={(e) => setEditingRoomName(e.target.value)}
                          onKeyDown={handleRenameKeyDown}
                          onBlur={saveRenameRoom}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleSelectRoom(room.id)}
                          className={`flex items-center gap-3 w-full p-2.5 rounded-xl transition-colors text-left border pr-16 ${
                            roomId === room.id 
                              ? 'bg-orange-100 text-orange-800 border-orange-200' 
                              : 'text-gray-600 hover:bg-gray-50 border-transparent'
                          }`}
                        >
                          <Users size={16} className={roomId === room.id ? 'text-orange-600' : 'text-gray-400 group-hover:text-orange-600 transition-colors'} />
                          <span className="truncate flex-1 text-xs font-medium">{room.name || "Phòng chung"}</span>
                          {room.is_private && <Lock size={11} className="text-gray-300 flex-shrink-0" />}
                        </button>
                        {/* Chỉ hiện nút action cho người tạo phòng */}
                        {room.created_by === user?.id && (
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => startRenameRoom(e, room.id, room.name || "Phòng chung")}
                              className="p-1.5 text-gray-400 hover:text-blue-500 bg-white rounded-lg"
                              title="Đổi tên phòng"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteRoom(e, room.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 bg-white rounded-lg"
                              title="Xóa phòng"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayChats.length > 0 && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">
                Hôm nay
              </div>
              <div className="space-y-1">
                {todayChats.map(chat => (
                  <div key={chat.id} className="relative group">
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-2 w-full p-2 rounded-xl border border-blue-300 bg-blue-50 shadow-sm">
                        <MessageSquare size={16} className="text-blue-500 flex-shrink-0 ml-1" />
                        <input
                          type="text"
                          className="flex-1 text-xs font-medium bg-white border border-blue-200 outline-none rounded p-1 text-gray-800"
                          value={editingChatTitle}
                          onChange={(e) => setEditingChatTitle(e.target.value)}
                          onKeyDown={handleRenameChatKeyDown}
                          onBlur={saveRenameChat}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleSelectChat(chat.id)}
                          className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left border pr-14 ${
                            activeChatId === chat.id 
                              ? 'bg-orange-50/50 text-orange-800 border-orange-100/50' 
                              : 'text-gray-600 hover:bg-gray-50 border-transparent'
                          }`}
                        >
                          <MessageSquare size={18} className={activeChatId === chat.id ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500 transition-colors'} />
                          <span className="truncate flex-1 text-sm font-medium pr-2">{chat.title}</span>
                        </button>
                        
                        {/* Cụm Nút Action của Chat Cá Nhân */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white md:bg-gray-50 md:group-hover:bg-transparent rounded-lg px-1 py-1">
                          <button 
                            onClick={(e) => startRenameChat(e, chat.id, chat.title)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Đổi tên cuộc trò chuyện"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Xóa cuộc trò chuyện"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
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
                    {editingChatId === chat.id ? (
                      <div className="flex items-center gap-2 w-full p-2 rounded-xl border border-blue-300 bg-blue-50 shadow-sm">
                        <MessageSquare size={16} className="text-blue-500 flex-shrink-0 ml-1" />
                        <input
                          type="text"
                          className="flex-1 text-xs font-medium bg-white border border-blue-200 outline-none rounded p-1 text-gray-800"
                          value={editingChatTitle}
                          onChange={(e) => setEditingChatTitle(e.target.value)}
                          onKeyDown={handleRenameChatKeyDown}
                          onBlur={saveRenameChat}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleSelectChat(chat.id)}
                          className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left border pr-14 ${
                            activeChatId === chat.id 
                              ? 'bg-orange-50/50 text-orange-800 border-orange-100/50' 
                              : 'text-gray-600 hover:bg-gray-50 border-transparent'
                          }`}
                        >
                          <MessageSquare size={18} className={activeChatId === chat.id ? 'text-orange-500' : 'text-gray-400 group-hover:text-orange-500 transition-colors'} />
                          <span className="truncate flex-1 text-sm font-medium pr-2">{chat.title}</span>
                        </button>
                        
                        {/* Cụm Nút Action của Chat Cá Nhân */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white md:bg-gray-50 md:group-hover:bg-transparent rounded-lg px-1 py-1">
                          <button 
                            onClick={(e) => startRenameChat(e, chat.id, chat.title)}
                            className="p-1.5 text-gray-400 hover:text-blue-500 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Đổi tên cuộc trò chuyện"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteChat(e, chat.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Xóa cuộc trò chuyện"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
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
      <main className="flex-1 flex flex-col relative overflow-hidden min-h-0">
        
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
        <div className="flex-1 flex flex-col items-center p-4 md:p-10 w-full min-h-0 overflow-hidden">
          
          {/* LOGO - ẩn khi có tin nhắn để tối đa không gian chat */}
          {messages.length === 0 && (
          <div className="flex flex-col items-center mb-6 transition-all duration-500 hover:scale-105 mt-8 md:mt-2 flex-shrink-0">
            <div className="w-20 h-20 flex items-center justify-center mb-3">
              <img src="/logo.png" alt="Sunna Edu Logo" className="w-full h-full object-contain drop-shadow-md" style={{ filter: 'hue-rotate(30deg) saturate(2) brightness(1.1)' }} />
            </div>
            <h1 className="text-4xl font-extrabold text-[#2c3e50] tracking-tight text-center">
              Sunna Edu <span className="text-orange-500">AI</span>
            </h1>
          </div>
          )}

          {/* KHU VỰC CHAT */}
          <div
            ref={chatContainerRef}
            onScroll={() => {
              const el = chatContainerRef.current;
              if (!el) return;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              userScrolledUp.current = !atBottom;
            }}
            className="flex-1 w-full max-w-3xl overflow-y-auto px-2 space-y-6 custom-scrollbar mb-4 min-h-0">
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
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700">
                            {children}
                          </a>
                        )
                      }}
                    >
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

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 font-medium animate-pulse">Đang tải chớp nhoáng...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { MessageSquare, Send, Search, ArrowLeft, Users, Circle, CheckCheck } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  attachment: string | null;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    photoUrl: string | null;
  };
}

interface DirectoryUser {
  id: string;
  username: string;
  employeeId: string;
  photoUrl: string | null;
  role: string;
  status: string;
  designation?: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'https://ems-backend-z3bv.onrender.com';

function ChatContent() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'ONLINE' | 'ADMINS'>('ALL');
  const [messageInput, setMessageInput] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isAuthenticated, isLoading, router]);

  // Load staff directory
  const loadDirectory = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API}/employees/directory`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDirectory(data.employees || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken]);

  // Connect Socket.IO
  useEffect(() => {
    if (!accessToken || !isAuthenticated) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => console.log('Socket connected'));

    socket.on('users:online', (users: { userId: string }[]) => {
      setOnlineUsers(users.map(u => u.userId));
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('chat:typing', (data: { senderId: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUser(data.senderId);
      } else {
        setTypingUser(null);
      }
    });

    socket.on('employee:update', () => {
      loadDirectory();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, isAuthenticated, loadDirectory]);

  useEffect(() => {
    if (isAuthenticated && accessToken) loadDirectory();
  }, [isAuthenticated, accessToken, loadDirectory]);

  // Fetch message history for selected user
  const fetchMessages = useCallback(async () => {
    if (!accessToken || !selectedUser) return;
    try {
      const res = await fetch(`${API}/chat/messages/${selectedUser.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        socketRef.current?.emit('chat:read', { senderId: selectedUser.id });
      }
    } catch (err) {
      console.error(err);
    }
  }, [accessToken, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages();
    } else {
      setMessages([]);
    }
  }, [selectedUser, fetchMessages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || sendLoading) return;
    setSendLoading(true);

    const content = messageInput.trim();
    setMessageInput('');

    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:send', {
        receiverId: selectedUser.id,
        content,
      });

      fetch(`${API}/notifications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          title: `New Message from ${user?.role === 'ADMIN' ? 'PJSOFONIC Admin' : user?.username}`,
          message: content.length > 60 ? content.slice(0, 60) + '...' : content,
          type: 'MESSAGE',
        }),
      }).catch(console.error);
    } else {
      try {
        const res = await fetch(`${API}/chat/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ receiverId: selectedUser.id, content }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => [...prev, data.message]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    setSendLoading(false);
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (selectedUser && socketRef.current) {
      socketRef.current.emit('chat:typing', { receiverId: selectedUser.id, isTyping: true });
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {
        socketRef.current?.emit('chat:typing', { receiverId: selectedUser.id, isTyping: false });
      }, 1500);
    }
  };

  const filteredDirectory = directory.filter(u => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchSearch) return false;
    if (filterMode === 'ONLINE') return onlineUsers.includes(u.id);
    if (filterMode === 'ADMINS') return u.role === 'ADMIN';
    return true;
  });

  const sorted = [
    ...filteredDirectory.filter(u => u.role === 'ADMIN'),
    ...filteredDirectory.filter(u => u.role !== 'ADMIN'),
  ];

  if (isLoading || pageLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1 pt-20 pb-24 px-4 md:px-6 flex items-center justify-center">
          <div className="text-cyan-400 animate-pulse text-sm flex items-center gap-2">
            <MessageSquare className="animate-spin" size={18} /> Loading messaging interface...
          </div>
        </main>
      </div>
    );
  }

  const isSelectedUserOnline = selectedUser ? onlineUsers.includes(selectedUser.id) : false;

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      {/* Main chat wrapper adjusted for mobile viewport */}
      <main className="flex-1 pt-18 md:pt-20 pb-22 md:pb-24 px-2 sm:px-4 md:px-8 flex flex-col h-[100dvh] max-w-7xl mx-auto w-full">
        
        {/* Title bar - hidden on mobile when viewing a conversation */}
        <div className={`mb-2 md:mb-3 px-2 ${selectedUser ? 'hidden md:block' : 'block'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-2xl font-extrabold tracking-tight">
                EMS <span className="gradient-text">Real-time Messaging</span>
              </h1>
              <p className="text-white/50 text-[11px] md:text-xs">Chat with admin, colleagues, and all staff in real-time.</p>
            </div>
            <div className="text-[11px] text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>{onlineUsers.length} Online</span>
            </div>
          </div>
        </div>

        {/* Chat Main Card */}
        <div className="flex-1 flex bg-black/90 border border-cyan-500/30 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.15)] min-h-0">
          
          {/* Left: Staff Directory list (Full width on mobile when no contact selected, hidden on mobile when contact selected) */}
          <div
            className={`w-full md:w-[320px] lg:w-[360px] border-r border-cyan-500/20 flex flex-col bg-black/95 shrink-0 ${
              selectedUser ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Search and Filters Header */}
            <div className="p-3 border-b border-cyan-500/20 space-y-2">
              <div className="bg-white/5 rounded-xl px-3 py-2 flex items-center gap-2 border border-cyan-500/30 focus-within:border-cyan-400 focus-within:shadow-[0_0_12px_rgba(0,240,255,0.3)] transition-all">
                <Search size={14} className="text-cyan-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search staff by name or ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-white outline-none w-full text-xs placeholder:text-white/40"
                />
              </div>

              {/* Quick filter tabs for easy mobile tapping */}
              <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setFilterMode('ALL')}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    filterMode === 'ALL'
                      ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(0,240,255,0.5)]'
                      : 'bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  All ({directory.length})
                </button>
                <button
                  onClick={() => setFilterMode('ONLINE')}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 ${
                    filterMode === 'ONLINE'
                      ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(57,255,20,0.5)]'
                      : 'bg-white/5 text-green-400/80 hover:text-green-300'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Online ({onlineUsers.length})
                </button>
                <button
                  onClick={() => setFilterMode('ADMINS')}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 ${
                    filterMode === 'ADMINS'
                      ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)]'
                      : 'bg-white/5 text-purple-300/80 hover:text-purple-200'
                  }`}
                >
                  👑 Admin
                </button>
              </div>
            </div>

            {/* Contacts List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5 touch-pan-y">
              {sorted.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/40 flex flex-col items-center gap-2">
                  <Users size={24} className="text-white/20" />
                  No contacts found.
                </div>
              ) : (
                sorted.map(u => {
                  const isOnline = onlineUsers.includes(u.id);
                  const displayUsername = u.role === 'ADMIN' ? 'PJSOFONIC' : u.username;
                  const isSelf = u.id === user?.id;

                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all active:scale-[0.98] ${
                        selectedUser?.id === u.id
                          ? 'bg-cyan-500/20 border border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold overflow-hidden text-sm shadow-inner">
                          {u.photoUrl ? (
                            <img src={u.photoUrl} alt={displayUsername} className="w-full h-full object-cover" />
                          ) : (
                            displayUsername.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                            isOnline ? 'bg-green-400 shadow-[0_0_6px_#39ff14]' : 'bg-white/20'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-white truncate">{displayUsername}</span>
                          {u.role === 'ADMIN' && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.2 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-cyan-400/70 flex items-center justify-between mt-0.5">
                          <span className="truncate">#{u.employeeId} {isSelf && '(You)'}</span>
                          <span className={isOnline ? 'text-green-400 font-medium' : 'text-white/30'}>
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Chat Window (Full width on mobile when contact selected) */}
          <div
            className={`flex-1 flex flex-col justify-between bg-black min-w-0 ${
              selectedUser ? 'flex' : 'hidden md:flex'
            }`}
          >
            {selectedUser ? (
              <>
                {/* Chat Header with Mobile Back Button */}
                <div className="p-3 sm:p-4 border-b border-cyan-500/20 flex items-center justify-between gap-2 bg-white/5 backdrop-blur-md">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    {/* Back button for mobile view */}
                    <button
                      onClick={() => setSelectedUser(null)}
                      title="Back to contacts"
                      className="md:hidden p-1.5 -ml-1 text-cyan-400 hover:text-white hover:bg-cyan-500/20 rounded-xl transition-all flex items-center justify-center shrink-0 active:scale-95"
                    >
                      <ArrowLeft size={19} />
                    </button>

                    <div className="relative shrink-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold overflow-hidden text-sm shadow-[0_0_10px_rgba(0,240,255,0.3)]">
                        {selectedUser.photoUrl ? (
                          <img src={selectedUser.photoUrl} alt={selectedUser.username} className="w-full h-full object-cover" />
                        ) : (
                          (selectedUser.role === 'ADMIN' ? 'PJSOFONIC' : selectedUser.username).charAt(0).toUpperCase()
                        )}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${
                          isSelectedUserOnline ? 'bg-green-400 shadow-[0_0_6px_#39ff14]' : 'bg-white/20'
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-white truncate">
                        {selectedUser.role === 'ADMIN' ? 'PJSOFONIC (Admin)' : selectedUser.username}
                      </h4>
                      <div className="text-[10px] text-cyan-400 flex items-center gap-1.5 truncate">
                        <span>#{selectedUser.employeeId}</span>
                        <span>•</span>
                        {typingUser === selectedUser.id ? (
                          <span className="text-cyan-300 font-medium animate-pulse">✍️ typing...</span>
                        ) : (
                          <span className={isSelectedUserOnline ? 'text-green-400 font-medium' : 'text-white/40'}>
                            {isSelectedUserOnline ? 'Online' : 'Offline'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Header info pill */}
                  <div className="hidden sm:flex items-center text-[10px] text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                    Real-time Direct Chat
                  </div>
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-black/70 touch-pan-y">
                  {messages.map(msg => {
                    const isOwn = msg.senderId === user?.id;
                    const senderName =
                      msg.sender?.id && msg.sender.id !== user?.id
                        ? directory.find(d => d.id === msg.sender.id)?.role === 'ADMIN'
                          ? 'PJSOFONIC'
                          : msg.sender.username
                        : user?.role === 'ADMIN'
                        ? 'PJSOFONIC'
                        : user?.username || 'You';

                    return (
                      <div key={msg.id} className={`flex items-end gap-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold text-[11px] shrink-0 mb-0.5 overflow-hidden">
                            {msg.sender?.photoUrl ? (
                              <img src={msg.sender.photoUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                              senderName.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs ${
                            isOwn
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-medium rounded-br-xs shadow-[0_0_15px_rgba(0,240,255,0.35)]'
                              : 'bg-white/10 text-white border border-cyan-500/30 rounded-bl-xs'
                          }`}
                        >
                          {!isOwn && (
                            <div className="text-[9px] font-bold text-cyan-300 mb-0.5 uppercase tracking-wider">
                              {senderName}
                            </div>
                          )}

                          <p className="break-words leading-relaxed text-[13px] sm:text-xs select-text">
                            {msg.content}
                          </p>

                          <div className={`flex items-center justify-end gap-1 text-[9px] mt-1 ${isOwn ? 'text-black/70' : 'text-white/40'}`}>
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOwn && (
                              <CheckCheck size={12} className={msg.isRead ? 'text-blue-900' : 'text-black/60'} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 text-xs py-16">
                      <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-2">
                        <MessageSquare size={22} />
                      </div>
                      <span className="font-bold text-white/70">No messages yet</span>
                      <span className="text-[11px] text-white/40 mt-0.5">Send a message to start the conversation!</span>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-2 sm:p-3 border-t border-cyan-500/20 bg-black/95 flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder={`Message ${selectedUser.role === 'ADMIN' ? 'PJSOFONIC' : selectedUser.username}...`}
                    value={messageInput}
                    onChange={handleTyping}
                    className="flex-1 input-glass text-xs sm:text-sm py-2.5 px-3.5 rounded-xl"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendLoading}
                    className="btn-primary py-2.5 px-3.5 sm:px-4 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                  >
                    <Send size={15} />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white/30">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_20px_rgba(0,240,255,0.2)]">
                  <MessageSquare size={32} />
                </div>
                <h3 className="font-bold text-base text-white">Select a Contact</h3>
                <p className="text-xs text-white/50 max-w-[220px] mt-1 leading-relaxed">
                  Choose any team member or admin from the directory to start messaging.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageCircle, Send, Globe, MapPin, User,
  RefreshCw, X
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/lib/translations';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('http', 'ws').replace('https', 'wss');

export default function ChatPage({ user }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const [activeTab, setActiveTab] = useState('global');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const token = localStorage.getItem('token');

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket connection with reconnection logic
  const connectWebSocket = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      const ws = new WebSocket(`${WS_URL}/ws/chat?token=${token}`);
      
      ws.onopen = () => {
        console.log('Chat WebSocket connected');
        setIsConnected(true);
        
        // Subscribe to current city if selected
        if (selectedCity) {
          ws.send(JSON.stringify({ action: 'subscribe_city', city_id: selectedCity }));
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            const msg = data.message;
            
            // Add message to state if it belongs to current chat
            setMessages(prev => {
              // Check if message already exists (avoid duplicates)
              if (prev.some(m => m.id === msg.id)) return prev;
              
              // Check if message belongs to current chat
              const belongsToChat = 
                (activeTab === 'global' && msg.chat_type === 'global') ||
                (activeTab === 'city' && msg.chat_type === 'city' && msg.city_id === selectedCity) ||
                (activeTab === 'private' && msg.chat_type === 'private' && 
                  (msg.sender_id === selectedConversation?.partner_id || 
                   msg.recipient_id === selectedConversation?.partner_id ||
                   msg.sender_id === user?.id));
              
              if (belongsToChat) {
                return [...prev, msg];
              }
              return prev;
            });
            
            // Update unread count for messages not from current user
            if (msg.recipient_id === user?.id && msg.sender_id !== user?.id) {
              setUnreadCount(prev => prev + 1);
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
      
      ws.onclose = () => {
        console.log('Chat WebSocket disconnected');
        setIsConnected(false);
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [token, selectedCity, activeTab, selectedConversation, user?.id]);

  // Initialize WebSocket
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Load initial data
  useEffect(() => {
    if (!token) {
      navigate('/auth?mode=login');
      return;
    }
    loadCities();
    loadUnreadCount();
    loadGlobalMessages();
  }, [token, navigate]);

  // Reload messages when tab changes
  useEffect(() => {
    if (activeTab === 'global') {
      loadGlobalMessages();
    } else if (activeTab === 'private') {
      loadConversations();
    }
  }, [activeTab]);

  const loadGlobalMessages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/chat/messages/global?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load global messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCityMessages = async (cityId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/chat/messages/city/${cityId}?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
      
      // Subscribe via WebSocket
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'subscribe_city', city_id: cityId }));
      }
    } catch (error) {
      console.error('Failed to load city messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrivateMessages = async (partnerId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/chat/messages/private/${partnerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load private messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetch(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadCities = async () => {
    try {
      const res = await fetch(`${API}/cities`);
      if (res.ok) {
        const data = await res.json();
        setCities(data.cities || []);
      }
    } catch (error) {
      console.error('Failed to load cities:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await fetch(`${API}/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const content = newMessage.trim();
    setNewMessage(''); // Clear input immediately
    
    let chatType = activeTab;
    let cityId = null;
    let recipientId = null;
    
    if (activeTab === 'city') {
      cityId = selectedCity;
      if (!cityId) {
        toast.error(t('selectCityChat'));
        return;
      }
    } else if (activeTab === 'private') {
      recipientId = selectedConversation?.partner_id;
      if (!recipientId) {
        toast.error(t('selectRecipientChat'));
        return;
      }
    }
    
    // Optimistically add message to UI
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      content,
      chat_type: chatType,
      city_id: cityId,
      sender_id: user?.id,
      sender_username: user?.username || t('youSender'),
      recipient_id: recipientId,
      created_at: new Date().toISOString(),
      is_sending: true
    };
    
    setMessages(prev => [...prev, optimisticMessage]);
    
    try {
      const res = await fetch(`${API}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content,
          chat_type: chatType,
          city_id: cityId,
          recipient_id: recipientId
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send message');
      }
      
      const data = await res.json();
      
      // Replace optimistic message with real one
      setMessages(prev => prev.map(m => 
        m.id === optimisticMessage.id ? { ...data.message, is_sending: false } : m
      ));
    } catch (error) {
      toast.error(error.message);
      // Remove failed optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
    }
  };

  const handleTabChange = (tab) => {
    // Unsubscribe from previous city
    if (selectedCity && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe_city', city_id: selectedCity }));
    }
    
    setActiveTab(tab);
    setMessages([]);
    setSelectedConversation(null);
    setSelectedCity(null);
  };

  const handleCitySelect = (cityId) => {
    // Unsubscribe from previous city
    if (selectedCity && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'unsubscribe_city', city_id: selectedCity }));
    }
    
    setSelectedCity(cityId);
    loadCityMessages(cityId);
  };

  const handleConversationSelect = (conv) => {
    setSelectedConversation(conv);
    loadPrivateMessages(conv.partner_id);
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const canSendMessage = 
    activeTab === 'global' || 
    (activeTab === 'city' && selectedCity) || 
    (activeTab === 'private' && selectedConversation);

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      <Sidebar user={user} />
      
      <div className="flex-1 flex flex-col lg:ml-16 h-screen overflow-hidden">
        {/* Fixed Header - Mobile Optimized */}
        <div className="flex-shrink-0 p-4 pt-4 lg:pt-4 border-b border-white/10 bg-void z-10">
          <PageHeader
            icon={<MessageCircle className="w-5 h-5 lg:w-8 lg:h-8 text-cyber-cyan" />}
            title={t('chatPageTitle')}
            actionButtons={
              <Button 
                onClick={() => {
                  if (activeTab === 'global') loadGlobalMessages();
                  else if (activeTab === 'city' && selectedCity) loadCityMessages(selectedCity);
                  else if (activeTab === 'private' && selectedConversation) loadPrivateMessages(selectedConversation.partner_id);
                }} 
                variant="outline" 
                size="icon"
                className="border-white/10 h-8 w-8 sm:h-10 sm:w-10"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            }
          />

          {/* Tabs */}
          <div className="mt-4">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="bg-white/5 border border-white/10">
                <TabsTrigger value="global" className="data-[state=active]:bg-cyber-cyan data-[state=active]:text-black">
                  <Globe className="w-4 h-4 mr-2" />
                  {t('globalChatTab')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content Area - SCROLLABLE */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* City/Conversation Sidebar */}
          {(activeTab === 'city' || activeTab === 'private') && (
            <div className="w-64 border-r border-white/10 flex flex-col flex-shrink-0 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {activeTab === 'city' ? (
                    cities.length === 0 ? (
                      <div className="text-center py-8 text-text-muted">
                        <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('noCities')}</p>
                      </div>
                    ) : (
                      cities.map(city => (
                        <div
                          key={city.id}
                          onClick={() => handleCitySelect(city.id)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            selectedCity === city.id
                              ? 'bg-amber-500/20 border border-amber-500/30'
                              : 'bg-white/5 border border-transparent hover:bg-white/10'
                          }`}
                        >
                          <div className="font-medium text-white">
                            {typeof city.name === 'object' ? city.name.ru || city.name.en : city.name}
                          </div>
                          <div className="text-xs text-text-muted">
                            {city.stats?.total_plots || 0} {t('plotsCount')}
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    conversations.length === 0 ? (
                      <div className="text-center py-8 text-text-muted">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{t('noConversations')}</p>
                      </div>
                    ) : (
                      conversations.map(conv => (
                        <div
                          key={conv.partner_id}
                          onClick={() => handleConversationSelect(conv)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            selectedConversation?.partner_id === conv.partner_id
                              ? 'bg-purple-500/20 border border-purple-500/30'
                              : 'bg-white/5 border border-transparent hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyber-cyan to-neon-purple flex items-center justify-center text-sm font-bold text-black flex-shrink-0">
                              {(conv.partner_username || 'U')[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white truncate">
                                {conv.partner_username}
                              </div>
                              {conv.last_message && (
                                <div className="text-xs text-text-muted truncate">
                                  {conv.last_message.content}
                                </div>
                              )}
                            </div>
                            {conv.unread_count > 0 && (
                              <Badge className="bg-red-500 text-xs flex-shrink-0">{conv.unread_count}</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Messages List */}
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
              <div className="space-y-3">
                {isLoading ? (
                  <div className="text-center py-12 text-text-muted">
                    <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin opacity-50" />
                    <p>{t('loadingMessages')}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>
                      {activeTab === 'global' && t('writeFirstMessage')}
                      {activeTab === 'city' && (selectedCity ? t('noMessagesInCity') : t('selectCityLeft'))}
                      {activeTab === 'private' && (selectedConversation ? t('startConversation') : t('selectRecipientLeft'))}
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <motion.div
                        key={msg.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: msg.is_sending ? 0.6 : 1, y: 0 }}
                        className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isOwn 
                            ? 'bg-cyber-cyan text-black' 
                            : 'bg-gradient-to-br from-cyber-cyan/50 to-neon-purple/50 text-white'
                        }`}>
                          {(msg.sender_username || 'U')[0].toUpperCase()}
                        </div>
                        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div className={`text-xs mb-1 flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className={isOwn ? 'text-cyber-cyan' : 'text-white/70'}>
                              {isOwn ? t('youSender') : msg.sender_username}
                            </span>
                            <span className="text-text-muted">{formatTime(msg.created_at)}</span>
                            {msg.is_sending && <span className="text-yellow-500 text-xs">{t('sendingMsg')}</span>}
                          </div>
                          <div className={`p-3 rounded-xl ${
                            isOwn
                              ? 'bg-cyber-cyan/20 border border-cyber-cyan/30'
                              : 'bg-white/10 border border-white/10'
                          }`}>
                            <p className="text-white text-sm break-words">{msg.content}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input - FIXED AT BOTTOM */}
            {canSendMessage && (
              <div className="flex-shrink-0 p-4 border-t border-white/10 bg-void">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={t('enterMessagePlaceholder')}
                    className="flex-1 bg-white/5 border-white/10 focus:border-cyber-cyan"
                    maxLength={1000}
                  />
                  <Button 
                    onClick={handleSendMessage}
                    className="bg-cyber-cyan text-black hover:bg-cyber-cyan/80"
                    disabled={!newMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

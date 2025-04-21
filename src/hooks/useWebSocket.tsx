
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { API_ENDPOINTS } from '../config/api';
import { toast } from 'sonner';
import { showChatNotification } from '@/components/ChatNotification';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  payload: any;
}

export const useWebSocket = () => {
  const { token, userId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const messageHandlers = useRef<Map<string, Set<(payload: any) => void>>>(
    new Map()
  );
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const chatMatch = path.match(/\/chat\/([^\/]+)/);
    if (chatMatch && chatMatch[1]) {
      currentChatIdRef.current = chatMatch[1];
    } else {
      currentChatIdRef.current = null;
    }

    const handleRouteChange = () => {
      const path = window.location.pathname;
      const chatMatch = path.match(/\/chat\/([^\/]+)/);
      if (chatMatch && chatMatch[1]) {
        currentChatIdRef.current = chatMatch[1];
      } else {
        currentChatIdRef.current = null;
      }
    };

    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const connect = useCallback(() => {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `${API_ENDPOINTS.WEBSOCKET}?token=${token}`;
    
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        reconnectAttempts.current = 0;
        setIsConnected(true);
        
        // Only show toast when not in a chat
        if (!currentChatIdRef.current) {
          toast.success('Connected to messaging server', { id: 'ws-connect' });
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message.type, message);
          
          setLastMessage(message);
          
          if (message.type === 'new_message') {
            if (message.payload.message.senderId !== userId) {
              handleNewMessage(message.payload);
            }
          } else if (message.type === 'qr_verified' || message.type === 'qr_connected') {
            if (message.payload.initiatedBy === userId) {
              handleQREvent(message.payload);
            }
          }
        
          const handlers = messageHandlers.current.get(message.type);
          if (handlers) {
            handlers.forEach(handler => handler(message.payload));
          }
          
          if (message.type === 'new_message') {
            if (message.payload.message && message.payload.message.senderId !== userId) {
              queryClient.invalidateQueries({ queryKey: ['chats'] });
              
              if (message.payload.chatId === currentChatIdRef.current) {
                queryClient.invalidateQueries({ queryKey: ['messages', message.payload.chatId] });
              }
            }
          } else if (message.type === 'chat_update' || message.type === 'qr_verified' || message.type === 'qr_connected') {
            queryClient.invalidateQueries({ queryKey: ['chats'] });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected with code:', event.code);
        setIsConnected(false);
        
        if (token && event.code !== 1000) {
          reconnectWithBackoff();
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      reconnectWithBackoff();
    }
  }, [token, queryClient, userId]);

  const handleNewMessage = useCallback((payload: any) => {
    console.log('Handling new message:', payload);
    
    if (payload.message && payload.sender && payload.chatId && 
        payload.message.senderId !== userId) {
      
      const messageObject = {
        ...payload.message,
        sent: false,
        timestamp: payload.message.sentAt,
        status: 'sent'
      };
      
      if (payload.chatId !== currentChatIdRef.current) {
        showChatNotification(
          messageObject, 
          payload.sender,
          payload.chatId,
          (chatId: string) => {
            console.log('Notification clicked, navigating to:', chatId);
            navigate(`/chat/${chatId}`);
            
            queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
            queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
          }
        );
      }
      
      if (payload.chatId === currentChatIdRef.current) {
        queryClient.invalidateQueries({ queryKey: ['messages', payload.chatId] });
      }
    }
  }, [navigate, queryClient, userId]);

  const handleQREvent = useCallback((payload: any) => {
    console.log('Handling QR event:', payload);
    
    if (payload.chatId) {
      
      if (payload.initiatedBy === userId) {
        toast.success(`New connection established with ${payload.user?.displayName || 'user'}`);
        queryClient.invalidateQueries({ queryKey: ['chats'] });
        
        if (payload.chatId) {
          navigate(`/chat/${payload.chatId}`);
        }
      }
    }
  }, [queryClient, navigate, userId]);

  const reconnectWithBackoff = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
    
      const delay = 1000 * (reconnectAttempts.current + 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        reconnectAttempts.current++;
        connect();
      }, delay);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }, [connect, maxReconnectAttempts]);

  const onMessage = useCallback((type: string, handler: (payload: any) => void) => {
    if (!messageHandlers.current.has(type)) {
      messageHandlers.current.set(type, new Set());
    }
    messageHandlers.current.get(type)?.add(handler);

    return () => {
      const handlers = messageHandlers.current.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlers.current.delete(type);
        }
      }
    };
  }, []);

  const sendMessage = useCallback((type: string, payload: any = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return true;
    } else {
      console.log('WebSocket not connected, attempting to reconnect');
      connect();
      return false;
    }
  }, [connect]);

  useEffect(() => {
    if (token) {
      connect();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, connect]);

  useEffect(() => {
    const handleFocus = () => {
      if (!isConnected && token) {
        console.log('Window focused, attempting reconnect');
        connect();
      }
    };
    
    const handleOnline = () => {
      if (!isConnected && token) {
        console.log('Network connection restored, attempting reconnect');
        connect();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [isConnected, token, connect]);

  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        console.log('Sending ping');
        sendMessage('ping');
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  return { 
    isConnected, 
    lastMessage, 
    sendMessage, 
    onMessage,
    reconnect: connect
  };
};

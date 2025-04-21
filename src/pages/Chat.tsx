
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getChatDetails, getChatMessages, sendMessage, deleteMessage, markChatAsRead } from '@/services/chatService';
import { useAuth } from '@/hooks/useAuth';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Message, MessageType } from '@/types/chatTypes';
import MessageInput from '@/components/MessageInput';
import ChatMessage from '@/components/ChatMessage';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { MoreVertical, AlertCircle, ArrowLeft, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const { token, userId, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onMessage, sendMessage: sendSocketMessage, isConnected } = useWebSocket();
  const [error, setError] = useState<string | null>(null);
  const [fallbackChatName, setFallbackChatName] = useState<string>('Chat');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<MessageType[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesQueryRef = useRef(0);

  const isMountedRef = useRef(false);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getMessagesQueryKey = useCallback(() => {
    return ['messages', id, messagesQueryRef.current];
  }, [id]);

  const forceRefreshMessages = useCallback(() => {
    messagesQueryRef.current += 1;
    queryClient.removeQueries({ queryKey: ['messages', id] });
  }, [id, queryClient]);

  const {
    data: chatDetails,
    isLoading: isLoadingChat,
    error: chatError,
    refetch: refetchChatDetails
  } = useQuery({
    queryKey: ['chat', id],
    queryFn: () => getChatDetails(token, id!),
    enabled: !!id && !!token,
    retry: 5,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  const {
    data: fetchedMessages = [],
    isLoading: isLoadingMessages,
    error: messagesError,
    refetch: refetchMessages
  } = useQuery({
    queryKey: getMessagesQueryKey(),
    queryFn: () => getChatMessages(token, id!),
    enabled: !!id && !!token,
    refetchInterval: isOnline ? 10000 : false,
    refetchOnWindowFocus: isOnline,
    retry: 7,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  useEffect(() => {
    if (id && token && isOnline && fetchedMessages.length > 0) {
      markChatAsRead(token, id).catch(error => {
        console.error('Error marking chat as read:', error);
      });
    }
  }, [id, token, isOnline, fetchedMessages.length]);

  const messages = [...fetchedMessages, ...pendingMessages];

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => {
      setIsSendingMessage(true);
      return sendMessage(token, id!, content);
    },
    onSuccess: (newMessage) => {
      setPendingMessages(prev => prev.filter(msg => 
        !(msg.content === newMessage.content && msg.status === 'sending')
      ));
      queryClient.setQueryData(getMessagesQueryKey(), (oldMessages: Message[] | undefined) => 
        [...(oldMessages || []), newMessage]
      );
      setTimeout(() => {
        if (isMountedRef.current) {
          forceRefreshMessages();
        }
      }, 1000);
      setTimeout(() => {
        if (isMountedRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          setIsSendingMessage(false);
        }
      }, 100);
    },
    onError: (error) => {
      toast.error('Failed to send message. Please try again.');
      console.error('Error sending message:', error);
      setIsSendingMessage(false);
      setPendingMessages(prev => 
        prev.map(msg => 
          msg.status === 'sending' ? { ...msg, status: 'failed' as const } : msg
        )
      );
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (messageId: string) => deleteMessage(token, id!, messageId),
    onSuccess: (_, messageId) => {
      queryClient.setQueryData(getMessagesQueryKey(), (oldMessages: Message[] | undefined) => 
        (oldMessages || []).filter(msg => msg.id !== messageId)
      );
      setPendingMessages(prev => prev.filter(msg => msg.id !== messageId));
    },
    onError: () => {
      toast.error('Failed to delete message');
    },
  });

  const handleSendMessage = (content: string) => {
    if (!content.trim() || !id || isSendingMessage) return;
    
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }
    
    const optimisticMessage: MessageType = {
      id: `pending-${Date.now()}`,
      chatId: id,
      senderId: userId || '',
      content: content,
      sentAt: new Date().toISOString(),
      sent: true,
      timestamp: new Date().toISOString(),
      status: 'sending' as const,
      isDisappearing: false,
    };
    
    setPendingMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 10);
    
    if (isOnline) {
      sendMessageMutation.mutate(content);
    } else {
      
      setTimeout(() => {
        setPendingMessages(prev => 
          prev.map(msg => 
            msg.id === optimisticMessage.id 
              ? { ...msg, status: 'failed' as const } 
              : msg
          )
        );
        toast.error("You're offline. Message will be sent when connection is restored.");
      }, 1000);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (messageId.startsWith('pending-')) {
      setPendingMessages(prev => prev.filter(msg => msg.id !== messageId));
      return;
    }
    
    deleteMessageMutation.mutate(messageId);
  };

  const handleRefresh = () => {
    if (id) {
      toast.info('Refreshing conversation...');
      refetchChatDetails();
      forceRefreshMessages();
    }
  };

  const handleResetChat = () => {
    if (id) {
      forceRefreshMessages();
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
      toast.success('Chat history has been reset');
    }
  };

  const handleRetryMessage = (content: string) => {
    setPendingMessages(prev => prev.filter(msg => !(msg.status === 'failed' && msg.content === content)));
    handleSendMessage(content);
  };

  useEffect(() => {
    if (chatError) {
      setError('Error loading chat details. Please try refreshing the page.');
    } else if (messagesError && fetchedMessages.length === 0) {
      setError('Error loading messages. Please try refreshing the conversation.');
    } else {
      setError(null);
    }
  }, [chatError, messagesError, fetchedMessages.length]);

  useEffect(() => {
    if (chatError && messages.length > 0) {
      const otherUserMessage = messages.find(msg => msg.senderId !== userId);
      if (otherUserMessage) {
        setFallbackChatName(`Chat ${id?.slice(0, 8)}`);
        setTimeout(() => {
          refetchChatDetails();
        }, 5000);
      }
    }
  }, [chatError, messages, id, userId, refetchChatDetails]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!id || !onMessage) return;

    const unsubscribe = onMessage('new_message', (payload) => {
      if (payload.chatId === id && payload.message.senderId !== userId) {
        if (payload.sender && !chatDetails) {
          setFallbackChatName(`Chat with ${payload.sender.displayName || payload.sender.username}`);
        }
        
        queryClient.setQueryData(getMessagesQueryKey(), (oldMessages: Message[] | undefined) => {
          if (!oldMessages) return [payload.message];
          const exists = oldMessages.some(msg => msg.id === payload.message.id);
          if (exists) return oldMessages;
          return [...oldMessages, payload.message];
        });
        
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [id, onMessage, queryClient, chatDetails, userId, getMessagesQueryKey]);

  useEffect(() => {
    if (id && isConnected) {
      sendSocketMessage('subscribe', { chatId: id });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    }

    return () => {
      if (id && isConnected) {
        sendSocketMessage('unsubscribe', { chatId: id });
      }
    };
  }, [id, sendSocketMessage, queryClient, isConnected]);

  useEffect(() => {
    if (isConnected && id) {
      refetchChatDetails();
      forceRefreshMessages();
      sendSocketMessage('subscribe', { chatId: id });
    }
  }, [isConnected, id, refetchChatDetails, forceRefreshMessages, sendSocketMessage]);

  useEffect(() => {
    if (isOnline && pendingMessages.some(msg => msg.status === 'failed')) {
      toast.success('Connection restored. Retrying failed messages...');
      
    
      const failedMessages = pendingMessages.filter(msg => msg.status === 'failed');
      
      failedMessages.forEach(msg => {
     
        setPendingMessages(prev => 
          prev.map(m => 
            m.id === msg.id ? { ...m, status: 'sending' as const } : m
          )
        );
        
        sendMessageMutation.mutate(msg.content);
      });
    }
  }, [isOnline, pendingMessages]);

  if (error && messages.length === 0) {
    return (
      <div className="container max-w-lg mx-auto p-4 flex flex-col h-full">
        <PageHeader 
          title="Error" 
          leftAction={
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft size={20} />
            </Button>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2 justify-center mt-4">
              <Button onClick={() => navigate('/')}>Return Home</Button>
              <Button variant="outline" onClick={handleRefresh}>Try Again</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chatName = chatDetails?.name || fallbackChatName || 'Chat';
  const headerActions = (
    <div className="flex items-center gap-2">
      {isOnline ? 
        <Wifi size={16} className="text-green-500" /> : 
        <WifiOff size={16} className="text-destructive" />
      }
      <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
        <RefreshCw size={18} />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleResetChat} title="Reset Chat History">
        <MoreVertical size={20} />
      </Button>
    </div>
  );

  const headerLeftAction = (
    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
      <ArrowLeft size={20} />
    </Button>
  );

  const convertedMessages: MessageType[] = messages.map(message => {
    if (typeof message.sent !== 'undefined') {
      return message as MessageType;
    }
    
    return {
      id: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      content: message.content,
      sentAt: message.sentAt,
      sent: message.senderId === userId,
      timestamp: message.sentAt,
      status: message.status || 'sent',
      isDisappearing: message.isDisappearing
    };
  });

  return (
    <div className="container max-w-lg mx-auto pb-16 flex flex-col h-full">
      {isLoadingChat ? (
        <div className="p-4 border-b">
          <Skeleton className="h-6 w-32" />
        </div>
      ) : (
        <PageHeader 
          title={chatName} 
          actions={headerActions} 
          leftAction={headerLeftAction}
        />
      )}

      {!isOnline && (
        <Alert className="mx-4 mt-2">
          <WifiOff className="h-4 w-4 mr-2" />
          <AlertDescription>
            You're offline. Messages will be sent when connection is restored.
          </AlertDescription>
        </Alert>
      )}

      {chatError && !error && (
        <Alert variant="default" className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertDescription>
            Could not load chat details, but messages are available
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingMessages && convertedMessages.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))
        ) : convertedMessages.length > 0 ? (
          <>
            {convertedMessages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.senderId === userId}
                onDelete={() => handleDeleteMessage(message.id)}
                onRetry={message.status === 'failed' ? () => handleRetryMessage(message.content) : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No messages yet. Start a conversation!
          </div>
        )}
      </div>

      <div className="p-4 border-t bg-background sticky bottom-0">
        <MessageInput 
          onSendMessage={handleSendMessage} 
          disabled={isSendingMessage}
          placeholder={isSendingMessage ? "Sending..." : "Type a message..."}
        />
      </div>
    </div>
  );
};

export default Chat;

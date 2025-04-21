
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getUserChats } from '@/services/chatService';
import ChatList from '@/components/ChatList';
import { Chat } from '@/types/chatTypes';
import PageHeader from '@/components/PageHeader';
import { Plus, QrCode, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

const Index = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { onMessage, isConnected } = useWebSocket();
  
  const { 
    data: fetchedChats = [], 
    isLoading, 
    isError,
    refetch
  } = useQuery({
    queryKey: ['chats'],
    queryFn: () => getUserChats(token || ''),
    refetchInterval: 5000, 
    refetchOnWindowFocus: true,
    retry: 3,  
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), 
    staleTime: 0, 
    meta: {
      onError: (error: any) => {
        console.error('Error fetching chats:', error);
      }
    }
  });

  const chats: Chat[] = fetchedChats.map(chat => ({
    ...chat,
    timestamp: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
    unreadCount: chat.unreadCount || 0,
    members: chat.members || [],
    notificationsEnabled: chat.notificationsEnabled !== undefined ? chat.notificationsEnabled : true,
  }));

  useEffect(() => {
    if (!onMessage) return;
    
    const unsubscribe = onMessage('new_message', (payload) => {
      if (payload.message && payload.message.senderId !== user?.id) {
        console.log('New message received, refreshing chats');
        refetch();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onMessage, refetch, user?.id]);

  useEffect(() => {
    if (!onMessage) return;
    
    const unsubscribe = onMessage('chat_update', (payload) => {
      if (payload.members && payload.members.includes(user?.id)) {
        console.log('Chat update relevant to current user, refreshing chats');
        refetch();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onMessage, refetch, user?.id]);

  useEffect(() => {
    if (!onMessage) return;
    
    const unsubscribe = onMessage('qr_connected', (payload) => {
      if (payload && payload.initiatedBy === user?.id) {
        console.log('QR connection completed by current user, refreshing chats', payload);
        refetch();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onMessage, refetch, user?.id]);

  useEffect(() => {
    if (!onMessage) return;
    
    const unsubscribe = onMessage('qr_verified', (payload) => {
      if (payload && payload.initiatedBy === user?.id) {
        console.log('QR verification completed by current user, refreshing chats', payload);
        refetch();
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [onMessage, refetch, user?.id]);

  useEffect(() => {
    if (isConnected) {
      console.log('WebSocket connected, refreshing chats');
      refetch();
    }
  }, [isConnected, refetch]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing chats');
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    refetch();
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);
  
  const handleCreateNewChat = () => {
    navigate('/new-chat');
  };
  
  const handleScanQR = () => {
    navigate('/scan');
  };

  const handleRefreshChats = () => {
    toast.info('Refreshing chats...', { id: 'refresh-chats' });
    refetch();
  };
  
  const headerActions = (
    <div className="flex gap-2">
      <Button 
        variant="ghost" 
        size="icon"
        onClick={handleRefreshChats}
        title="Refresh Chats"
      >
        <RefreshCw size={18} />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        onClick={handleScanQR}
        title="Scan QR Code"
      >
        <QrCode size={20} />
      </Button>
      <Button 
        variant="ghost" 
        size="icon"
        onClick={handleCreateNewChat}
        title="New Chat"
      >
        <Plus size={20} />
      </Button>
    </div>
  );
  
  return (
    <div className="container max-w-md mx-auto pt-4 pb-16 px-4 flex flex-col h-full">
      <PageHeader 
        title="Chats" 
        showBackButton={false}
        actions={headerActions}
      />
      
      <div className="flex-1 flex flex-col">
        {isError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <p className="text-destructive mb-4">Failed to load conversations</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        ) : isLoading && chats.length === 0 ? (
          <div className="flex-1 flex flex-col gap-3 pt-4">
            {[...Array(5)].map((_, i) => (
              <div 
                key={i} 
                className="h-16 bg-muted animate-pulse rounded-md"
              />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <h3 className="text-xl font-semibold mb-2">No chats yet</h3>
            <p className="text-muted-foreground mb-6">
              Create a new chat or connect with someone by scanning their QR code
            </p>
            <div className="flex gap-4">
              <Button onClick={handleCreateNewChat}>
                <Plus className="mr-2 h-4 w-4" />
                New Chat
              </Button>
              <Button onClick={() => navigate('/scan')} variant="outline">
                <QrCode className="mr-2 h-4 w-4" />
                Scan QR
              </Button>
            </div>
          </div>
        ) : (
          <ChatList 
            chats={chats} 
            onChatClick={(chatId) => navigate(`/chat/${chatId}`)} 
            className="pt-2" 
          />
        )}
      </div>
    </div>
  );
};

export default Index;

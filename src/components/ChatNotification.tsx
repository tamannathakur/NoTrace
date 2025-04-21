
import React from 'react';
import { Bell } from 'lucide-react';
import { User, MessageType } from '@/types/chatTypes';
import { toast } from 'sonner';

interface NotificationProps {
  message: MessageType;
  sender: User;
  chatId: string;
  onClick?: (chatId: string) => void;
}

export const showChatNotification = (message: MessageType, sender: User, chatId: string, onClick?: (chatId: string) => void) => {
  console.log('Showing notification for chat:', chatId, 'from sender:', sender);
  
  toast(
    <ChatNotification 
      message={message} 
      sender={sender}
      chatId={chatId}
      onClick={onClick} 
    />,
    {
      duration: 5000,
      position: 'top-right',
    }
  );
};

const ChatNotification: React.FC<NotificationProps> = ({ message, sender, chatId, onClick }) => {
  const handleClick = () => {
    console.log('Notification clicked, invoking onClick for chatId:', chatId);
    if (onClick) {
      onClick(chatId);
    }
  };

  return (
    <div 
      className="flex items-start gap-3 cursor-pointer" 
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-1">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">
          {sender.displayName || sender.username || 'User'}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {message.content || 'New message'}
        </p>
      </div>
    </div>
  );
};

export default ChatNotification;

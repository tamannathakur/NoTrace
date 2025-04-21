
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { Message as MessageType } from '@/types/chatTypes';
import { useAuth } from '@/hooks/useAuth';

interface MessageProps {
  message: MessageType;
  members: any[];
}

const MessageComponent: React.FC<MessageProps> = ({ message, members }) => {
  const { user } = useAuth();
  const isMine = message.senderId === user?.id;
  
  const senderName = members.find((m) => m.id === message.senderId)?.displayName || 'Unknown';
  
  const messageDate = message.sentAt 
    ? new Date(message.sentAt) 
    : (typeof message.timestamp === 'string'
      ? new Date(message.timestamp)
      : message.timestamp);
  
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4 px-4`}>
      <div 
        className={`rounded-lg p-3 max-w-[75%] ${
          isMine 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        }`}
      >
        {!isMine && (
          <p className="text-xs font-medium mb-1">{senderName}</p>
        )}
        
        <p className={`text-sm ${isMine ? 'text-primary-foreground' : 'text-foreground'}`}>
          {message.content}
        </p>
        
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-xs opacity-70">
            {formatDistanceToNow(messageDate, { addSuffix: true })}
          </span>
          
          {isMine && (
            message.status === 'read' ? 
              <CheckCheck size={12} className="opacity-70" /> :
              <Check size={12} className="opacity-70" />
          )}
          
          {message.isDisappearing && (
            <Clock size={12} className="opacity-70" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageComponent;

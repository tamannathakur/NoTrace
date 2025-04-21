
import { MessageType } from '@/types/chatTypes';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, Clock, X, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './ui/button';

interface ChatMessageProps {
  message: MessageType;
  isOwnMessage: boolean;
  onDelete: () => void;
  onRetry?: () => void;
}

const ChatMessage = ({ message, isOwnMessage, onDelete, onRetry }: ChatMessageProps) => {
  const messageDate = typeof message.timestamp === 'string' 
    ? new Date(message.timestamp) 
    : message.timestamp;

  const getStatusIcon = () => {
    if (message.status === 'sending') {
      return <Clock size={14} className="text-muted-foreground animate-pulse" />;
    } else if (message.status === 'failed') {
      return <AlertTriangle size={14} className="text-destructive" />;
    } else if (message.status === 'read') {
      return <CheckCheck size={14} className="text-primary" />;
    } else if (message.status === 'delivered') {
      return <CheckCheck size={14} className="text-muted-foreground" />;
    } else {
      return <Check size={14} className="text-muted-foreground" />;
    }
  };

  const getBgColor = () => {
    if (isOwnMessage) {
      if (message.status === 'failed') {
        return 'bg-red-100 dark:bg-red-900 text-foreground';
      }
      return 'bg-primary text-primary-foreground';
    }
    return 'bg-muted';
  };

  return (
    <div className={`flex mb-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`relative rounded-lg p-3 max-w-[75%] ${getBgColor()}`}>
        <p className="text-sm break-words">{message.content}</p>
        
        <div className="flex items-center text-xs mt-1 justify-end gap-1">
          <span className="opacity-70">
            {formatDistanceToNow(messageDate, { addSuffix: true })}
          </span>
          
          {isOwnMessage && getStatusIcon()}
          
          {message.isDisappearing && (
            <Clock size={14} className="opacity-70" />
          )}
        </div>
        
        {isOwnMessage && (
          <div className="absolute bottom-0 right-0 translate-y-full mt-1 flex gap-1">
            {message.status === 'failed' && onRetry && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-6 py-0 px-2 text-xs" 
                onClick={onRetry}
              >
                <RotateCw size={12} className="mr-1" /> Retry
              </Button>
            )}
            
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 py-0 px-2 text-xs text-destructive hover:text-destructive" 
              onClick={onDelete}
            >
              <X size={12} className="mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

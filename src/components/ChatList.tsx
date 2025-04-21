
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellOff, Lock, Folder } from 'lucide-react';
import { Chat } from '@/types/chatTypes';

interface ChatListProps {
  chats: Chat[];
  onChatClick: (chatId: string) => void;
  className?: string;
}

const ChatList: React.FC<ChatListProps> = ({ chats, onChatClick, className }) => {
  const sortedChats = [...chats].sort((a, b) => {
    const timeA = a.lastMessageAt || a.updatedAt || a.createdAt;
    const timeB = b.lastMessageAt || b.updatedAt || b.createdAt;
    
    const dateA = new Date(timeA).getTime();
    const dateB = new Date(timeB).getTime();
    
    return dateB - dateA;
  });
  
  const groupedChats: Record<string, Chat[]> = {};
  
  sortedChats.forEach(chat => {
    const folderName = chat.folder || '';
    if (!groupedChats[folderName]) {
      groupedChats[folderName] = [];
    }
    groupedChats[folderName].push(chat);
  });
  
  const folderNames = Object.keys(groupedChats).sort((a, b) => {
    if (a === '') return -1;
    if (b === '') return 1;
    return a.localeCompare(b);
  });
  
  return (
    <div className={`pb-20 ${className || ''}`}>
      {folderNames.map((folder) => (
        <div key={folder} className="mb-4">
          {folder !== '' && (
            <div className="px-4 py-2 flex items-center text-sm text-muted-foreground">
              <Folder size={16} className="mr-2" />
              <span>{folder}</span>
            </div>
          )}
          
          {groupedChats[folder].map(chat => (
            <div 
              key={chat.id}
              onClick={() => onChatClick(chat.id)}
              className="flex items-center p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold mr-3">
                {chat.name ? chat.name.charAt(0).toUpperCase() : '?'}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium truncate">{chat.name || 'Unnamed Conversation'}</h3>
                  <span className="text-xs text-muted-foreground">
                    {chat.lastMessageAt && formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: true })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                  
                  <div className="flex items-center space-x-1">
                    {chat.isSecure && <Lock size={14} className="text-accent" />}
                    
                    {chat.notificationsEnabled ? 
                      <Bell size={14} className="text-muted-foreground" /> : 
                      <BellOff size={14} className="text-muted-foreground" />
                    }
                    
                    {chat.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs font-semibold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ChatList;

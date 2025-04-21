
export interface User {
  id: string;
  username: string;
  displayName: string;
  profilePicture?: string;
}

export interface Chat {
  id: string;
  name: string;
  lastMessage?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
  isSecure: boolean;
  folder?: string;
  unreadCount: number;
  members: User[];
  notificationsEnabled: boolean;
  timestamp?: string; 
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  isDisappearing?: boolean;
  disappearAfter?: number;
  timestamp: string;
  sent: boolean;
  status: 'sent' | 'delivered' | 'read' | 'sending' | 'failed';
}

export interface MessageType {
  id: string;
  content: string;
  sent: boolean;
  timestamp: string | Date; 
  status: 'sent' | 'delivered' | 'read' | 'sending' | 'failed';
  isDisappearing?: boolean;
  senderId?: string;
  chatId?: string;
  sentAt?: string;
}

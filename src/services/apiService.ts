import { API_ENDPOINTS } from '../config/api';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || `API error: ${response.status}`;
    console.error('API error response:', errorData);
    throw new Error(errorMessage);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
};

interface AuthCredentials {
  username: string;
  password: string;
}

interface RegisterData extends AuthCredentials {
  displayName: string;
  email?: string;
}

interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  console.log('Registering user:', data.username);
  const response = await fetch(API_ENDPOINTS.REGISTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  return handleResponse(response);
};

export const login = async (credentials: AuthCredentials): Promise<AuthResponse> => {
  console.log('Logging in user:', credentials.username);
  const response = await fetch(API_ENDPOINTS.LOGIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  
  return handleResponse(response);
};

export const refreshToken = async (token: string): Promise<AuthResponse> => {
  console.log('Refreshing token');
  const response = await fetch(API_ENDPOINTS.REFRESH_TOKEN, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export interface User {
  id: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  createdAt: string;
}

export const generateQRCode = async (token: string, expiresIn: number = 15): Promise<QRCodeData> => {
  const response = await fetch(API_ENDPOINTS.GENERATE_QR, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ expiresIn }) 
  });
  
  const data = await handleResponse(response);

  return {
    connectionId: data.codeId || data.connectionId,
    expiresAt: data.expiresAt,
    qrCodeUrl: data.qrCodeUrl
  };
};

export interface QRCodeData {
  connectionId: string;
  expiresAt: string;
  qrCodeUrl?: string;
}

export const verifyQRCode = async (token: string, connectionId: string): Promise<ConnectionResult> => {
  const response = await fetch(API_ENDPOINTS.VERIFY_QR, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ codeId: connectionId }) 
  });
  
  return handleResponse(response);
};

export interface ConnectionResult {
  success: boolean;
  chatId?: string;
  message?: string;
  user?: User;
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
}

export const getUserChats = async (token: string): Promise<Chat[]> => {
  const response = await fetch(API_ENDPOINTS.GET_CHATS, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export const getChatDetails = async (token: string, chatId: string): Promise<Chat> => {
  const response = await fetch(API_ENDPOINTS.GET_CHAT(chatId), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export interface CreateChatData {
  name: string;
  memberIds: string[];
  isSecure?: boolean;
  folder?: string;
}

export const createChat = async (token: string, data: CreateChatData): Promise<Chat> => {
  const response = await fetch(API_ENDPOINTS.CREATE_CHAT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return handleResponse(response);
};

export interface UpdateChatData {
  name?: string;
  folder?: string;
  isSecure?: boolean;
}

export const updateChat = async (token: string, chatId: string, data: UpdateChatData): Promise<Chat> => {
  const response = await fetch(API_ENDPOINTS.UPDATE_CHAT(chatId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return handleResponse(response);
};

export const deleteChat = async (token: string, chatId: string): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.DELETE_CHAT(chatId), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
  isDisappearing?: boolean;
  disappearAfter?: number; 
}

export const getChatMessages = async (token: string, chatId: string): Promise<Message[]> => {
  const response = await fetch(API_ENDPOINTS.GET_MESSAGES(chatId), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export interface SendMessageData {
  content: string;
  isDisappearing?: boolean;
  disappearAfter?: number; 
}

export const sendMessage = async (
  token: string, 
  chatId: string, 
  data: SendMessageData
): Promise<Message> => {
  const response = await fetch(API_ENDPOINTS.SEND_MESSAGE(chatId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  
  return handleResponse(response);
};

export const markMessageAsRead = async (
  token: string,
  chatId: string,
  messageId: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.UPDATE_MESSAGE(chatId, messageId), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ isRead: true })
  });
  
  return handleResponse(response);
};

export const deleteMessage = async (
  token: string,
  chatId: string,
  messageId: string
): Promise<void> => {
  const response = await fetch(API_ENDPOINTS.DELETE_MESSAGE(chatId, messageId), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export class WebSocketService {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private messageHandlers: ((data: any) => void)[] = [];
  private connectionStateHandlers: ((connected: boolean) => void)[] = [];
  
  constructor(private token: string) {}
  
  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }
    
    this.socket = new WebSocket(`${API_ENDPOINTS.WEBSOCKET}?token=${this.token}`);
    
    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.notifyConnectionState(true);
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyMessageHandlers(data);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    this.socket.onclose = () => {
      this.notifyConnectionState(false);
      this.reconnect();
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.socket?.close();
    };
  }
  
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.messageHandlers = [];
    this.connectionStateHandlers = [];
  }
  
  public send(data: any): boolean {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
  
  public onMessage(handler: (data: any) => void): () => void {
    this.messageHandlers.push(handler);
    
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }
  
  public onConnectionState(handler: (connected: boolean) => void): () => void {
    this.connectionStateHandlers.push(handler);
    
    return () => {
      this.connectionStateHandlers = this.connectionStateHandlers.filter(h => h !== handler);
    };
  }
  
  private notifyMessageHandlers(data: any): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        console.error('Error in message handler:', err);
      }
    });
  }
  
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (err) {
        console.error('Error in connection state handler:', err);
      }
    });
  }
  
  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

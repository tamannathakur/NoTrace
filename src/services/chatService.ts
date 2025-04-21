import { API_ENDPOINTS } from '../config/api';
import { Chat, Message } from '../types/chatTypes';

const OFFLINE_CHATS_KEY = 'offline_chats';
const OFFLINE_MESSAGES_KEY = 'offline_messages';

const makeRequest = async (url: string, options: RequestInit, retries = 3): Promise<any> => {
  let lastError;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Making API request to ${url} (attempt ${attempt + 1}/${retries})`);
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP error: ${response.status} ${response.statusText}`
        }));
        throw new Error(errorData.error || `HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`API request to ${url} succeeded:`, data);
      return data;
    } catch (error) {
      console.error(`Request failed (attempt ${attempt + 1}/${retries}):`, error);
      lastError = error;
      
      if (attempt < retries - 1) {
      
        const delay = 1000 * (attempt + 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

export const getChatList = async (token: string): Promise<Chat[]> => {
  try {
    
    const url = `${API_ENDPOINTS.GET_CHATS}?_t=${Date.now()}`;
    
    const chats = await makeRequest(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    localStorage.setItem(OFFLINE_CHATS_KEY, JSON.stringify(chats));
    console.log('Fetched and cached chats:', chats.length);
    
    return chats;
  } catch (error) {
    console.error('Error fetching chats:', error);
    
  
    const offlineChats = localStorage.getItem(OFFLINE_CHATS_KEY);
    if (offlineChats) {
      console.log('Using cached chats from local storage');
      return JSON.parse(offlineChats);
    }
    
    return [];
  }
};

export const getUserChats = getChatList;

export const getChatDetails = async (token: string, chatId: string): Promise<Chat> => {
  try {
    const url = `${API_ENDPOINTS.GET_CHAT(chatId)}?_t=${Date.now()}`;
    
    const chat = await makeRequest(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return chat;
  } catch (error) {
    console.error('Error fetching chat details:', error);
    
    const offlineChats = JSON.parse(localStorage.getItem(OFFLINE_CHATS_KEY) || '[]');
    const cachedChat = offlineChats.find((c: Chat) => c.id === chatId);
    
    if (cachedChat) {
      return cachedChat;
    }
    
    throw error;
  }
};

export const getChatMessages = async (token: string, chatId: string): Promise<Message[]> => {
  try {
    const url = `${API_ENDPOINTS.GET_MESSAGES(chatId)}?_t=${Date.now()}`;
    
    const messages = await makeRequest(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
   
    const processedMessages = messages.map((msg: any) => ({
      ...msg,
      status: 'sent',
      timestamp: msg.sentAt,
      sent: msg.senderId === JSON.parse(localStorage.getItem('user') || '{}').id
    }));
    
    const cacheKey = `${OFFLINE_MESSAGES_KEY}_${chatId}`;
    localStorage.setItem(cacheKey, JSON.stringify(processedMessages));
    
    return processedMessages;
  } catch (error) {
    console.error('Error fetching messages:', error);
    
    const cacheKey = `${OFFLINE_MESSAGES_KEY}_${chatId}`;
    const cachedMessages = localStorage.getItem(cacheKey);
    
    if (cachedMessages) {
      console.log('Using cached messages from local storage');
      return JSON.parse(cachedMessages);
    }
    
    return [];
  }
};

export const sendMessage = async (
  token: string, 
  chatId: string, 
  content: string,
  isDisappearing: boolean = false,
  disappearAfter: number = 0
): Promise<Message> => {
  try {
    console.log(`Attempting to send message - ChatID: ${chatId}, Content: ${content}`);
    
    const message = await makeRequest(
      API_ENDPOINTS.SEND_MESSAGE(chatId),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          isDisappearing,
          disappearAfter: isDisappearing ? disappearAfter : 0
        })
      }
    );
    
    console.log('Message sent successfully:', message);
    
    
    const cacheKey = `${OFFLINE_MESSAGES_KEY}_${chatId}`;
    const cachedMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    const processedMessage = {
      ...message,
      status: 'sent',
      timestamp: message.sentAt,
      sent: message.senderId === userId
    };
    
    cachedMessages.push(processedMessage);
    localStorage.setItem(cacheKey, JSON.stringify(cachedMessages));
    
    console.log('Message cached locally:', processedMessage);
    
    return processedMessage;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const createChat = async (
  token: string,
  name: string,
  memberIds: string[],
  isSecure: boolean = true
): Promise<Chat> => {
  try {
    console.log(`Creating new chat "${name}" with members:`, memberIds);
    
    const chat = await makeRequest(
      API_ENDPOINTS.CREATE_CHAT,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          memberIds,
          isSecure
        })
      }
    );
    
    const cachedChats = JSON.parse(localStorage.getItem(OFFLINE_CHATS_KEY) || '[]');
    cachedChats.push(chat);
    localStorage.setItem(OFFLINE_CHATS_KEY, JSON.stringify(cachedChats));
    
    console.log('Chat created and added to local cache:', chat);
    return chat;
  } catch (error) {
    console.error('Error creating chat:', error);
    throw error;
  }
};

export const deleteMessage = async (
  token: string,
  chatId: string,
  messageId: string
): Promise<boolean> => {
  try {
    await makeRequest(
      API_ENDPOINTS.DELETE_MESSAGE(chatId, messageId),
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const cacheKey = `${OFFLINE_MESSAGES_KEY}_${chatId}`;
    const cachedMessages = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const updatedMessages = cachedMessages.filter((msg: Message) => msg.id !== messageId);
    localStorage.setItem(cacheKey, JSON.stringify(updatedMessages));
    
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

export const markChatAsRead = async (
  token: string,
  chatId: string
): Promise<boolean> => {
  try {
    await makeRequest(
      `${API_ENDPOINTS.UPDATE_CHAT(chatId)}/read`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error marking chat as read:', error);
    return false;
  }
};

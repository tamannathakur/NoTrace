
const isDevelopment = import.meta.env.MODE === 'development';

export const API_BASE_URL = isDevelopment 
  ? import.meta.env.VITE_API_URL || 'http://localhost:8080/api'
  : '/api';

export const WS_BASE_URL = isDevelopment
  ? import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export const API_ENDPOINTS = {

  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGIN: `${API_BASE_URL}/auth/login`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh`,
  
  GENERATE_QR: `${API_BASE_URL}/qr/generate`,
  VERIFY_QR: `${API_BASE_URL}/qr/verify`,
  
  GET_CHATS: `${API_BASE_URL}/chats`,
  GET_CHAT: (id: string) => `${API_BASE_URL}/chats/${id}`,
  CREATE_CHAT: `${API_BASE_URL}/chats`,
  UPDATE_CHAT: (id: string) => `${API_BASE_URL}/chats/${id}`,
  DELETE_CHAT: (id: string) => `${API_BASE_URL}/chats/${id}`,
  
  GET_MESSAGES: (chatId: string) => `${API_BASE_URL}/chats/${chatId}/messages`,
  SEND_MESSAGE: (chatId: string) => `${API_BASE_URL}/chats/${chatId}/messages`,
  UPDATE_MESSAGE: (chatId: string, messageId: string) => 
    `${API_BASE_URL}/chats/${chatId}/messages/${messageId}`,
  DELETE_MESSAGE: (chatId: string, messageId: string) => 
    `${API_BASE_URL}/chats/${chatId}/messages/${messageId}`,
  
  GET_ALL_USERS: `${API_BASE_URL}/users`,
  GET_USER_PROFILE: (id: string) => `${API_BASE_URL}/users/${id}`,
  UPDATE_USER_PROFILE: (id: string) => `${API_BASE_URL}/users/${id}`,
  
  API_BASE_URL: API_BASE_URL,
  
  WEBSOCKET: WS_BASE_URL
};

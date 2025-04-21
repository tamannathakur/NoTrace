
import { API_ENDPOINTS } from '../config/api';
import { User } from '../types/chatTypes';


const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }
  
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return response.text();
};

export const getAllUsers = async (token: string): Promise<User[]> => {
  const response = await fetch(`${API_ENDPOINTS.API_BASE_URL}/users`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

export const getUserProfile = async (token: string, userId: string): Promise<User> => {
  const response = await fetch(API_ENDPOINTS.GET_USER_PROFILE(userId), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return handleResponse(response);
};

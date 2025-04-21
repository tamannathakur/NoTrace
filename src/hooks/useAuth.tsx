
import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, refreshToken, User } from '../services/apiService';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, displayName: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'qr_connect_token';
const REFRESH_TOKEN_KEY = 'qr_connect_refresh_token';
const USER_KEY = 'qr_connect_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);
        
        if (storedToken && storedRefreshToken && storedUser) {
          setToken(storedToken);
          setRefreshTokenValue(storedRefreshToken);
          setUser(JSON.parse(storedUser));
          
          try {
            console.log('Attempting to refresh token');
            const response = await refreshToken(storedRefreshToken);
            setToken(response.token);
            setRefreshTokenValue(response.refreshToken);
            setUser(response.user);
            
            localStorage.setItem(TOKEN_KEY, response.token);
            localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));
            console.log('Token refreshed successfully');
          } catch (error) {
            console.error('Failed to refresh token:', error);
            handleLogout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        handleLogout();
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      console.log(`Calling login API for user: ${username}`);
      const response = await apiLogin({ username, password });
      console.log('Login API response:', response);
      
      setToken(response.token);
      setRefreshTokenValue(response.refreshToken);
      setUser(response.user);
      
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (
    username: string, 
    password: string, 
    displayName: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await apiRegister({ 
        username, 
        password, 
        displayName 
      });
      
      setToken(response.token);
      setRefreshTokenValue(response.refreshToken);
      setUser(response.user);
      
      localStorage.setItem(TOKEN_KEY, response.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setRefreshTokenValue(null);
    setUser(null);
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const value = {
    user,
    token,
    refreshToken: refreshTokenValue,
    userId: user?.id || null,
    isAuthenticated: !!token && !!user,
    isLoading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

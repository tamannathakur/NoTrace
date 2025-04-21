
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, QrCode, Settings, Home } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <nav className="border-t bg-card py-2 px-4 fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Button 
          variant={isActive('/') ? "default" : "ghost"}
          size="icon"
          onClick={() => navigate('/')}
          title="Chats"
        >
          <Home size={20} />
        </Button>
        
        <Button 
          variant={isActive('/scan') ? "default" : "ghost"}
          size="icon"
          onClick={() => navigate('/scan')}
          title="Scan QR Code"
        >
          <QrCode size={20} />
        </Button>
        
        <Button 
          variant={isActive('/settings') ? "default" : "ghost"}
          size="icon"
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings size={20} />
        </Button>
      </div>
    </nav>
  );
};

export default NavBar;

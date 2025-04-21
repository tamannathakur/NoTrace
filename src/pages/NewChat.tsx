
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { createChat } from '@/services/chatService';
import PageHeader from '@/components/PageHeader';
import { useQueryClient } from '@tanstack/react-query';

const NewChat = () => {
  const [chatName, setChatName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();

  const handleCreateChat = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatName.trim()) {
      toast.error('Please enter a conversation name');
      return;
    }
    
    setIsLoading(true);
    
    try {
     
      if (!user?.id) {
        throw new Error('User ID is missing');
      }
      
      console.log('Creating new chat with name:', chatName);
      const chat = await createChat(
        token || '', 
        chatName,
        [user.id], 
        true 
      );
      
      console.log('Chat created successfully:', chat);
      
      await queryClient.invalidateQueries({ queryKey: ['chats'] });
      
      toast.success('Conversation created successfully');
  
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-md mx-auto pt-4 pb-16 px-4 flex flex-col h-full">
      <PageHeader title="New Conversation" />
      
      <form onSubmit={handleCreateChat} className="flex-1 flex flex-col gap-6 pt-6">
        <div className="space-y-2">
          <Input
            placeholder="Enter conversation name"
            value={chatName}
            onChange={(e) => setChatName(e.target.value)}
            disabled={isLoading}
            autoFocus
          />
        </div>
        
        <Button type="submit" disabled={isLoading || !chatName.trim()}>
          {isLoading ? 'Creating...' : 'Create Conversation'}
        </Button>
      </form>
    </div>
  );
};

export default NewChat;


import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScanner from '@/components/QRScanner';
import QRGenerator from '@/components/QRGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '@/components/PageHeader';
import { verifyQRCode } from '@/services/apiService';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Scan = () => {
  const [activeTab, setActiveTab] = useState<string>('scan');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const handleQRSuccess = async (connectionId: string) => {
    // Don't try to verify the same code twice in a row
    if (lastScannedCode === connectionId) {
      setError('This QR code has already been scanned. Please try a new code.');
      toast.error('This QR code has already been scanned. Please try a new code.');
      return;
    }
    
    try {
      setError(null);
      setIsVerifying(true);
      setLastScannedCode(connectionId);
      
      const result = await verifyQRCode(token || '', connectionId);
      
      if (result.success && result.chatId) {
        toast.success('Connection successful!');
        navigate(`/chat/${result.chatId}`);
      } else {
        setError(result.message || 'Failed to connect');
        toast.error(result.message || 'Failed to connect');
      }
    } catch (error: any) {
      console.error('Error verifying QR code:', error);
      const errorMessage = typeof error === 'object' && error !== null 
        ? error.message || 'Error verifying QR code' 
        : 'Unknown error occurred';
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };
  
  const clearError = () => {
    setError(null);
    setLastScannedCode(null);
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setError(null);
    setLastScannedCode(null);
  };
  
  return (
    <div className="container max-w-md mx-auto pt-4 pb-16 px-4 flex flex-col h-full">
      <PageHeader title={activeTab === 'scan' ? 'Scan QR Code' : 'Your QR Code'} />
      
      <div className="flex-1 flex flex-col">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription className="flex-1">
              {error}
              {error.toLowerCase().includes('already used') && (
                <div className="mt-2 text-xs">
                  This QR code has already been used. 
                  {activeTab === 'scan' ? (
                    <span> Ask the other user to generate a new code, or switch to the "Generate" tab to create your own.</span>
                  ) : (
                    <span> Generate a new QR code by clicking the "Generate New Code" button below.</span>
                  )}
                </div>
              )}
            </AlertDescription>
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2 h-8 w-8 p-0" 
              onClick={clearError}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </Alert>
        )}
        
        <Tabs defaultValue="scan" className="w-full" onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="scan">Scan</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
          </TabsList>
          
          <Card>
            <CardContent className="pt-6">
              <TabsContent value="scan" className="mt-0">
                <QRScanner 
                  onScanComplete={handleQRSuccess} 
                  isVerifying={isVerifying}
                  lastError={error}
                />
              </TabsContent>
              
              <TabsContent value="generate" className="mt-0">
                <QRGenerator errorState={error} onErrorClear={clearError} />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
};

export default Scan;

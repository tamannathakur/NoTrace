
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Camera, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { verifyQRCode } from '@/services/apiService';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface QRScannerProps {
  onScanComplete?: (connectionId: string) => void;
  isVerifying?: boolean;
  lastError?: string | null;
}

const QRScanner: React.FC<QRScannerProps> = ({ 
  onScanComplete,
  isVerifying = false,
  lastError = null
}) => {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (lastError && lastError.toLowerCase().includes('already used')) {
      setManualCode('');
    }
  }, [lastError]);

  const startScanning = () => {
 
    setErrorMessage(null);
    
    setScanning(true);
    toast.info('Camera access would be requested here in a full implementation');
    
    setTimeout(() => {
      setScanning(false);
      toast.info('For demo purposes, please enter the connection code manually');
    }, 2000);
  };
  
  const resetScanner = () => {
    setManualCode('');
    setErrorMessage(null);
    setScanning(false);
    setLoading(false);
  };
  
  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrorMessage(null);
    
    if (!token) {
      setErrorMessage('You must be logged in to connect');
      toast.error('You must be logged in to connect');
      return;
    }
    
    if (!manualCode) {
      setErrorMessage('Please enter a connection code');
      toast.error('Please enter a connection code');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Attempting to verify code:', manualCode);
      
      const connectionId = manualCode.includes('qrconnect://connect/') 
        ? manualCode.split('qrconnect://connect/')[1]
        : manualCode;
      
      console.log('Extracted connection ID:', connectionId);
      
      if (onScanComplete) {
        
        onScanComplete(connectionId);
        return;
      }
        
      const result = await verifyQRCode(token, connectionId);
      console.log('Verification result:', result);
      
      if (result.success && result.chatId) {
        toast.success(result.message || 'Connection successful!');
        setErrorMessage(null);
        setManualCode('');
    
        setTimeout(() => {
          navigate(`/chat/${result.chatId}`);
        }, 300);
      } else {
        const message = result.message || 'Failed to connect';
        setErrorMessage(message);
        toast.error(message);
      
        if (message.toLowerCase().includes('already used')) {
          setManualCode('');
        }
      }
    } catch (error: any) {
      console.error('QR verification error:', error);
      
      const errorMessage = typeof error === 'object' && error !== null 
        ? error.message || 'Failed to verify QR code' 
        : 'Unknown error occurred';
        
      setErrorMessage(errorMessage);
      toast.error(errorMessage);
      
      if (errorMessage.toLowerCase().includes('already used')) {
        setManualCode('');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const isLoading = loading || isVerifying;
  
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <Card className="w-full p-6 mb-6">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold mb-2">Scan QR Code</h2>
          <p className="text-sm text-muted-foreground">
            Scan another user's QR code to connect securely
          </p>
        </div>
        
        {errorMessage && !lastError && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 mb-6 text-sm">
            <p>{errorMessage}</p>
            {errorMessage.toLowerCase().includes('already used') && (
              <p className="mt-2">
                This code has already been used. Please ask the other user to generate a new QR code.
              </p>
            )}
          </div>
        )}
        
        {scanning ? (
          <div className="bg-muted rounded-md h-64 flex items-center justify-center mb-6">
            <Camera className="h-12 w-12 text-muted-foreground animate-pulse" />
          </div>
        ) : (
          <Button 
            onClick={startScanning} 
            className="w-full mb-6"
            variant="outline"
            disabled={isLoading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Start Camera Scan
          </Button>
        )}
        
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-muted" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or enter code manually
            </span>
          </div>
        </div>
        
        <form onSubmit={handleManualCodeSubmit} className="mt-6">
          <div className="flex space-x-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter connection code"
              className="flex-1 py-2 px-4 bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !manualCode}>
              {isLoading ? (
                <span className="h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {manualCode && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetScanner}
                className="text-xs text-muted-foreground h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
          )}
        </form>
      </Card>
      
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Scanning a QR code will initiate a secure connection. No personal information is shared until you approve.
      </p>
    </div>
  );
};

export default QRScanner;

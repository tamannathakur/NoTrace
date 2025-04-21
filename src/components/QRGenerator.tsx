
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Lock, Download, RefreshCw, Copy, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';
import { generateQRCode, QRCodeData } from '@/services/apiService';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebSocket } from '@/hooks/useWebSocket';

interface QRGeneratorProps {
  selfDestruct?: boolean;
  expiryTime?: number; 
  errorState?: string | null;
  onErrorClear?: () => void;
}

const QRGenerator: React.FC<QRGeneratorProps> = ({ 
  selfDestruct = false, 
  expiryTime = 5,
  errorState = null,
  onErrorClear = () => {}
}) => {
  const { token } = useAuth();
  const { isConnected, sendMessage, onMessage } = useWebSocket();
  const [qrValue, setQrValue] = useState<string>('');
  const [connectionId, setConnectionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  const [timeLeft, setTimeLeft] = useState<number | null>(
    selfDestruct ? expiryTime * 60 : null
  );
  
  useEffect(() => {
    if (errorState === null && error) {
      setError(null);
    }
  }, [errorState]);
  
  const fetchQRCode = async (skipGeneratedToast = false) => {
    if (!token) {
      toast.error('You must be logged in to generate a QR code');
      setError('Authentication required');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      if (onErrorClear) onErrorClear();
      
      console.log('Generating QR code with token:', token.substring(0, 10) + '...');
      
      const data = await generateQRCode(token, expiryTime);
      console.log('QR code generated successfully:', data);
      
      setQrData(data);
      const connectionUrl = `qrconnect://connect/${data.connectionId}`;
      setQrValue(connectionUrl);
      setConnectionId(data.connectionId);
      
      if (selfDestruct || timeLeft !== null) {
    
        const expiresAt = new Date(data.expiresAt).getTime();
        const now = Date.now();
        const secondsLeft = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(secondsLeft);
      }
   
      if (isConnected && data.connectionId) {
        sendMessage('subscribe', { qrCodeId: data.connectionId });
        console.log('Subscribed to QR code updates:', data.connectionId);
      }
      
      if (!skipGeneratedToast) {
        toast.success('QR Code generated successfully');
      }
    } catch (error: any) {
      console.error('Error generating QR code:', error);
      setError(error.message || 'Failed to generate QR code');
      toast.error('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };
  
  
  const forceRefresh = () => {
    setRefreshCounter(prev => prev + 1);
  };
  
  useEffect(() => {
    fetchQRCode();
    
    const unsubscribe = onMessage('qr_connected', (payload) => {
      console.log('QR code connected event received:', payload);
   
      if (payload && payload.chatId) {
      
        setTimeout(() => {
          fetchQRCode(true); 
          toast.info('Generated new QR code after successful connection');
        }, 1000);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [token, expiryTime, refreshCounter]);
  useEffect(() => {
    if (!timeLeft) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev && prev > 0) {
          return prev - 1;
        } else {
          clearInterval(timer);
          fetchQRCode();
          return expiryTime * 60;
        }
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft, expiryTime]);
  
  const formatTime = () => {
    if (!timeLeft) return '';
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    
    return `${minutes}:${seconds < 10 ? '0' + seconds : seconds}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(connectionId);
    setCopied(true);
    toast.success('Connection ID copied to clipboard');
    
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };
  
  const downloadQRCode = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pngFile = canvas.toDataURL('image/png');
        
        const downloadLink = document.createElement('a');
        downloadLink.download = `qrconnect-${Date.now()}.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };
  
  return (
    <div className="flex flex-col items-center animate-fade-in">
      <Card className="qr-container mb-6 relative p-6">
        <div className="absolute top-0 right-0 bg-primary text-white p-1 rounded-bl-lg rounded-tr-lg flex items-center text-xs">
          <Lock className="h-3 w-3 mr-1" />
          Secure
        </div>
        
        <div className={`absolute top-0 left-0 p-1 rounded-br-lg rounded-tl-lg flex items-center text-xs ${isConnected ? 'bg-green-500' : 'bg-amber-500'} text-white`}>
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 mr-1" />
              Live
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 mr-1" />
              Offline
            </>
          )}
        </div>
        
        {loading ? (
          <div className="h-[220px] w-[220px] flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="h-[220px] w-[220px] flex flex-col items-center justify-center text-destructive gap-2 p-4 text-center">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm font-medium">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchQRCode()} 
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : (
          <QRCode 
            id="qr-code"
            value={qrValue || 'loading...'}
            size={220}
            level="H" 
            fgColor="#4F46E5" 
            bgColor="white"
          />
        )}
        
        {selfDestruct && timeLeft && !error && (
          <div className="mt-3 text-center text-sm text-muted-foreground">
            Expires in {formatTime()}
          </div>
        )}
      </Card>
      
      <div className="w-full max-w-xs mb-6 flex items-center justify-between bg-muted p-3 rounded-md">
        {loading ? (
          <Skeleton className="h-5 w-full" />
        ) : (
          <>
            <div className="text-sm font-mono text-muted-foreground truncate mr-2">
              {connectionId || 'Not available'}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              disabled={!connectionId}
              className="h-8 px-2"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </>
        )}
      </div>
      
      <p className="text-center text-sm text-muted-foreground mb-6 max-w-xs">
        Have others scan this QR code to connect with you securely. No phone number or email required.
      </p>
      
      <div className="flex space-x-4">
        <Button 
          onClick={() => fetchQRCode()}
          disabled={loading}
        >
          {loading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          Generate New Code
        </Button>
        
        <Button 
          variant="outline"
          onClick={downloadQRCode}
          disabled={loading || !qrValue}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
};

export default QRGenerator;
